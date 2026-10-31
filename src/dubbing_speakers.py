"""Experimental cue-level grouping. Embeddings stay local; output uses public preset voices."""
import hashlib
import importlib.metadata
import json
import math
import os
from pathlib import Path
import re
import sys
import wave
import numpy as np


def digest(file):
    h = hashlib.sha256()
    with Path(file).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def normalized(value):
    a = np.asarray(value, dtype=np.float32)
    if a.shape != (192,) or not np.isfinite(a).all() or float(np.linalg.norm(a)) < 1e-8:
        raise ValueError('DUB_SPEAKER_EMBEDDING_INVALID')
    return a / np.linalg.norm(a)


def estimate_pitch(samples):
    # A pitch-range hint selects preset timbre, not a person's gender or identity.
    audio = np.asarray(samples, dtype=np.float32)[::2]
    estimates = []
    for offset in range(0, len(audio) - 800, 400):
        frame = audio[offset:offset + 800].copy()
        frame -= frame.mean()
        if float(np.sqrt(np.mean(frame * frame))) < .006:
            continue
        frame *= np.hanning(800)
        correlation = np.correlate(frame, frame, mode='full')[799:]
        if correlation[0] <= 1e-8:
            continue
        correlation /= correlation[0]
        peaks = [lag for lag in range(23, 123) if correlation[lag] > correlation[lag-1] and correlation[lag] >= correlation[lag+1]]
        if not peaks:
            continue
        strength = max(correlation[lag] for lag in peaks)
        if strength < .45:
            continue
        lag = min(lag for lag in peaks if correlation[lag] >= strength * .9)
        estimates.append(8000 / lag)
    return float(np.median(estimates)) if len(estimates) >= 5 else None


def group_embeddings(rows, presets, threshold=0.76):
    groups, assignments = [], []
    for row in rows:
        if row.get('embedding') is None:
            assignments.append({'id': row['id'], 'speakerId': None, 'reviewRequired': True, 'reason': row.get('reason', 'short-or-quiet')})
            continue
        emb = normalized(row['embedding'])
        similarities = [float(np.dot(emb, normalized(g['sum']))) for g in groups]
        best = int(np.argmax(similarities)) if similarities else -1
        if best < 0 or similarities[best] < threshold:
            if len(groups) >= 20:
                raise ValueError('DUB_SPEAKER_LIMIT_REVIEW_REQUIRED')
            groups.append({'id': 'speaker-' + str(len(groups) + 1), 'sum': emb.copy(), 'count': 1, 'pitches': []})
            best, similarity = len(groups) - 1, None
        else:
            similarity = similarities[best]
            groups[best]['sum'] += emb
            groups[best]['count'] += 1
        if row.get('pitchHz') is not None:
            groups[best]['pitches'].append(row['pitchHz'])
        assignments.append({'id': row['id'], 'speakerId': groups[best]['id'], 'similarity': similarity, 'reviewRequired': True})
    speakers = []
    for index, group in enumerate(groups):
        centroid = normalized(group['sum'])
        pitch = float(np.median(group['pitches'])) if group['pitches'] else None
        band = 'low' if pitch is not None and pitch < 145 else 'high' if pitch is not None and pitch > 185 else 'uncertain'
        pool = {k: p for k, p in presets.items() if band == 'uncertain' or p.get('gender') == ('male' if band == 'low' else 'female')}
        candidates = sorted([(float(np.dot(centroid, normalized(p['speaker_emb']))), name, p) for name, p in pool.items()], key=lambda p: (-p[0], p[1]))
        score, name, preset = candidates[0]
        speakers.append({'id': group['id'], 'label': 'Nguoi noi ' + str(index + 1), **({'voice': {'provider': 'vieneu', 'voiceId': name}} if band != 'uncertain' and score >= .65 else {}), 'suggestion': {'method': 'pitch-range-nearest-preset-experimental', 'pitchHz': round(pitch, 1) if pitch else None, 'pitchBand': band, 'similarity': round(score, 4), 'margin': round(score - candidates[1][0], 4) if len(candidates) > 1 else None, 'presetGender': preset.get('gender', 'unknown'), 'reviewRequired': True}})
    return {'speakers': speakers, 'assignments': assignments, 'method': 'local-cue-encoder-v1-experimental', 'threshold': threshold, 'quality': 'UNVERIFIED', 'reviewRequired': True}


def analyze(root, request):
    lock = json.loads((root / 'speaker-runtime.lock.json').read_text(encoding='utf-8'))
    if digest(sys.executable) != lock['pythonSha256'] or any(importlib.metadata.version(k) != v for k, v in lock['packages'].items()):
        raise ValueError('DUB_SPEAKER_RUNTIME_CHANGED')
    for relative, sha in lock['files'].items():
        file = (root / relative).resolve(strict=True)
        file.relative_to(root)
        if digest(file) != sha:
            raise ValueError('DUB_SPEAKER_RUNTIME_CHANGED')
    audio = Path(request['audio']).resolve(strict=True)
    audio.relative_to(root)
    if digest(audio) != request['audioSha256']:
        raise ValueError('DUB_SPEAKER_AUDIO_CHANGED')
    import ctypes
    class MemoryStatus(ctypes.Structure):
        _fields_ = [('length', ctypes.c_ulong), ('load', ctypes.c_ulong), ('total', ctypes.c_ulonglong), ('available', ctypes.c_ulonglong), ('pageTotal', ctypes.c_ulonglong), ('pageAvailable', ctypes.c_ulonglong), ('virtualTotal', ctypes.c_ulonglong), ('virtualAvailable', ctypes.c_ulonglong), ('extended', ctypes.c_ulonglong)]
    memory = MemoryStatus()
    memory.length = ctypes.sizeof(memory)
    if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(memory)) or memory.available < 1024 ** 3:
        raise ValueError('DUB_SPEAKER_RAM_GATE_1GIB')
    with wave.open(str(audio), 'rb') as stream:
        if (stream.getnchannels(), stream.getsampwidth(), stream.getframerate()) != (1, 2, 16000) or stream.getnframes() > 600 * 16000:
            raise ValueError('DUB_SPEAKER_AUDIO_INVALID')
        samples = np.frombuffer(stream.readframes(stream.getnframes()), dtype='<i2').astype(np.float32) / 32768
    import onnxruntime as ort
    from vieneu._v3_turbo_engine.speaker import OnnxSpeakerEncoder
    options = ort.SessionOptions()
    options.intra_op_num_threads = 2
    options.inter_op_num_threads = 1
    encoder = OnnxSpeakerEncoder(str(root / lock['encoder']), device='cpu', providers=['CPUExecutionProvider'], sess_options=options)
    presets = json.loads((root / lock['voices']).read_text(encoding='utf-8'))['presets']
    rows = []
    for s in request['segments']:
        start, end = s['start'], s['end']
        if not all(isinstance(v, (float, int)) and math.isfinite(v) for v in [start, end]) or not 0 <= start < end <= len(samples) / 16000 + .001:
            raise ValueError('DUB_SPEAKER_SEGMENTS_INVALID')
        cue = samples[round(start * 16000):round(min(end, start + 15) * 16000)]
        quiet = len(cue) < 16000 or float(np.sqrt(np.mean(cue * cue))) < .003
        rows.append({'id': s['id'], 'embedding': None if quiet else encoder.embed(cue, 16000), 'pitchHz': None if quiet else estimate_pitch(cue)})
    return group_embeddings(rows, presets)


if __name__ == '__main__':
    root = Path(__file__).resolve().parents[1]
    file = Path(sys.argv[1]).resolve(strict=True)
    file.relative_to(root)
    request = json.loads(file.read_text(encoding='utf-8'))
    result = {'schemaVersion': 1, 'nonce': request['nonce'], 'audioSha256': request['audioSha256']}
    try:
        result.update(analyze(root, request), status='VERIFIED')
    except Exception as e:
        code = str(e)
        result.update(status='FAILED', error=code if re.fullmatch('[A-Z0-9_]{1,80}', code) else 'DUB_SPEAKER_FAILED')
    with file.with_name('speakers-result.json').open('x', encoding='utf-8') as stream:
        json.dump(result, stream, ensure_ascii=True, allow_nan=False)
    print(json.dumps({'status': result['status'], 'error': result.get('error')}))
