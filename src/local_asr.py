"""One offline Whisper job in the pinned consumer or legacy runtime; exit releases its model."""
import hashlib
import importlib.metadata
import json
import math
import os
from pathlib import Path
import re
import sys
import time
import wave
import tempfile


def digest(file):
    h = hashlib.sha256()
    with Path(file).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def validate_audio(file, duration):
    with wave.open(str(file), 'rb') as audio:
        if (audio.getnchannels(), audio.getsampwidth(), audio.getframerate(), audio.getcomptype()) != (1, 2, 16000, 'NONE') or abs(audio.getnframes() / 16000 - duration) > 1 / 16000:
            raise ValueError('VOICE_ASR_AUDIO_INVALID')


def verify_model(model, lock):
    if model.name != lock['modelRevision'] or any(digest(model / name) != sha for name, sha in lock['files'].items()):
        raise ValueError('VOICE_ASR_MODEL_CHANGED')


def validate_segments(rows, duration):
    end = 0
    if not isinstance(rows, list) or len(rows) > 1000:
        raise ValueError('DUB_ASR_SEGMENTS_INVALID')
    for row in rows:
        start, stop, text = row['start'], row['end'], row['text']
        if not all(isinstance(v, (int, float)) and math.isfinite(v) for v in (start, stop)) or start < end or stop <= start or stop > duration or not isinstance(text, str) or len(text) > 240 or re.search(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', text):
            raise ValueError('DUB_ASR_SEGMENTS_INVALID')
        end = stop
    return rows


def chunk_cache_key(lock, request, offset, data):
    identity = {'schemaVersion': 1, 'implementation': digest(__file__), 'model': lock, 'audio': request['audioSha256'], 'language': request['language'], 'offset': offset, 'chunk': hashlib.sha256(data).hexdigest(), 'beam': 5}
    return hashlib.sha256(json.dumps(identity, sort_keys=True).encode()).hexdigest()


def read_chunk_cache(cache, key, duration):
    file = cache / (key + '.json')
    try:
        if file.is_symlink() or file.stat().st_size > 65536:
            return None
        record = json.loads(file.read_text(encoding='utf-8'))
        rows = validate_segments(record['rows'], duration)
        actual = hashlib.sha256(json.dumps(rows, sort_keys=True).encode()).hexdigest()
        if record['schemaVersion'] == 1 and record['key'] == key and record['sha256'] == actual:
            return rows
    except (OSError, ValueError, KeyError, TypeError):
        pass
    return None


def write_chunk_cache(cache, key, rows, duration):
    validate_segments(rows, duration)
    record = {'schemaVersion': 1, 'key': key, 'rows': rows, 'sha256': hashlib.sha256(json.dumps(rows, sort_keys=True).encode()).hexdigest()}
    text = json.dumps(record, ensure_ascii=True)
    if len(text.encode()) > 65536 or sum(1 for _ in cache.glob('*.json')) >= 128:
        return
    try:
        with (cache / (key + '.json')).open('x', encoding='utf-8') as stream:
            stream.write(text)
    except FileExistsError:
        pass


def transcribe(request):
    root = Path(__file__).resolve().parents[1]
    lock_name = request.get('runtimeLock', 'voicestudio-runtime.lock.json')
    if lock_name not in ('asr-runtime.lock.json', 'voicestudio-runtime.lock.json'):
        raise ValueError('VOICE_ASR_RUNTIME_CHANGED')
    lock = json.loads((root / lock_name).read_text(encoding='utf-8'))
    if lock_name == 'voicestudio-runtime.lock.json':
        lock = lock['asr']
    if digest(sys.executable) != lock['pythonSha256']:
        raise ValueError('VOICE_ASR_RUNTIME_CHANGED')
    if sys.version.split()[0] != lock['pythonVersion'] or any(importlib.metadata.version(name) != version for name, version in lock['packages'].items()):
        raise ValueError('VOICE_ASR_RUNTIME_CHANGED')
    model = Path(request['model']).resolve(strict=True)
    verify_model(model, lock)
    duration = request['duration']
    if not isinstance(duration, (int, float)) or not math.isfinite(duration) or not 0 < duration <= 600 or not re.fullmatch('[a-z]{2,3}', request['language']):
        raise ValueError('ASR_REQUEST_INVALID')
    if digest(request['audio']) != request['audioSha256']:
        raise ValueError('VOICE_ASR_AUDIO_CHANGED')
    validate_audio(request['audio'], duration)
    os.environ.update(HF_HUB_OFFLINE='1', TRANSFORMERS_OFFLINE='1', HF_HUB_DISABLE_TELEMETRY='1')
    import psutil
    free = psutil.virtual_memory().available
    if free < 4 * 1024 ** 3:
        raise ValueError('VOICE_RAM_GATE_4GIB')
    started = time.monotonic()
    from faster_whisper import WhisperModel
    whisper = None
    rows, cache_hits = [], 0
    cache = root / '.runtime' / 'asr-chunk-cache'
    if not cache.resolve().is_relative_to(root):
        raise ValueError('VOICE_ASR_CACHE_INVALID')
    cache.mkdir(parents=True, exist_ok=True)
    if cache.is_symlink() or not cache.resolve().is_relative_to(root):
        raise ValueError('VOICE_ASR_CACHE_INVALID')
    # Each PCM sample belongs to exactly one bounded chunk; timestamps return to video zero.
    with wave.open(str(request['audio']), 'rb') as original:
        for offset in range(0, original.getnframes(), 60 * 16000):
            original.setpos(offset)
            data = original.readframes(60 * 16000)
            key = chunk_cache_key(lock, request, offset, data)
            chunk_duration = min(len(data) / 32000, duration - offset / 16000)
            chunk_rows = read_chunk_cache(cache, key, chunk_duration)
            if chunk_rows is not None:
                cache_hits += 1
                rows.extend({'start': r['start'] + offset / 16000, 'end': r['end'] + offset / 16000, 'text': r['text']} for r in chunk_rows)
                continue
            if whisper is None:
                whisper = WhisperModel(str(model), device='cpu', compute_type='int8', cpu_threads=2, num_workers=1, local_files_only=True)
            chunk_rows = []
            with tempfile.TemporaryDirectory(prefix='asr-chunk-', dir=Path(request['audio']).parent) as temporary:
                chunk = Path(temporary) / 'chunk.wav'
                with wave.open(str(chunk), 'wb') as target:
                    target.setparams((1, 2, 16000, 0, 'NONE', 'not compressed'))
                    target.writeframes(data)
                segments, _info = whisper.transcribe(str(chunk), language=request['language'], beam_size=5, vad_filter=False, word_timestamps=True)
                for segment in segments:
                    text = segment.text.strip()
                    if len(text) <= 240:
                        pieces = [(segment.start, segment.end, text)]
                    else:
                        pieces, words, begin, end = [], '', None, None
                        for word in segment.words or []:
                            if len(word.word.strip()) > 240:
                                raise ValueError('DUB_ASR_WORD_TOO_LONG')
                            if len(words + word.word) > 240:
                                pieces.append((begin, end, words.strip()))
                                words, begin = '', None
                            if begin is None:
                                begin = word.start
                            words += word.word
                            end = word.end
                        if words.strip():
                            pieces.append((begin, end, words.strip()))
                        if not pieces:
                            raise ValueError('DUB_ASR_SEGMENTS_INVALID')
                    for start, end, text in pieces:
                        start = max(start, chunk_rows[-1]['end'] if chunk_rows else 0)
                        end = min(end, chunk_duration)
                        if text and end > start:
                            chunk_rows.append({'start': start, 'end': end, 'text': text})
            write_chunk_cache(cache, key, chunk_rows, chunk_duration)
            rows.extend({'start': r['start'] + offset / 16000, 'end': r['end'] + offset / 16000, 'text': r['text']} for r in chunk_rows)
    rows = validate_segments(rows, duration)
    return {'engine':'faster-whisper', 'model':'Systran/faster-whisper-small', 'modelRevision':lock['modelRevision'], 'device':'cpu', 'computeType':'int8', 'transport':'local-process', 'segments':rows, 'cacheHits':cache_hits, 'elapsedSeconds':time.monotonic()-started, 'availableRamBeforeLoad':free, 'availableRamAfterInference':psutil.virtual_memory().available, 'processRssAfterInference':psutil.Process().memory_info().rss, 'pid':os.getpid()}


if __name__ == '__main__':
    file = Path(sys.argv[1]).resolve(strict=True)
    request = json.loads(file.read_text(encoding='utf-8'))
    result = {'schemaVersion':1, 'nonce':request['nonce'], 'audioSha256':request['audioSha256']}
    try:
        result.update(transcribe(request), status='VERIFIED')
    except Exception as error:
        code = str(error)
        result.update(status='FAILED', error=code if re.fullmatch('[A-Z0-9_]{1,80}', code) else 'VOICE_ASR_FAILED')
    with file.with_name('asr-result.json').open('x', encoding='utf-8') as stream:
        json.dump(result, stream, ensure_ascii=True, allow_nan=False)
    print(json.dumps({'status':result['status'], 'error':result.get('error')}, ensure_ascii=True))
