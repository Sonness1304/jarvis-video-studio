"""Run the pinned companion without warming an unused TTS model."""
import hashlib
import json
import logging
import os
from pathlib import Path
import sys


def verify_runtime(project, lock):
    project = Path(project).resolve(strict=True)
    if lock.get('version') != '0.5.6':
        raise ValueError('VOICE_RUNTIME_CHANGED')
    for name in ('backend/main.py', 'backend/services/model_manager.py'):
        if hashlib.sha256((project / name).read_bytes()).hexdigest() != lock['files'].get(name):
            raise ValueError('VOICE_RUNTIME_CHANGED')
    return project / 'backend'


def disable_tts_warmup(manager):
    async def skip_warmup():
        logging.getLogger('jarvis.voice').info('Jarvis: TTS warmup skipped; on-demand loading unchanged')
    manager.preload_model = skip_warmup


def install_after_initialization(app):
    phase_a = app._phase_a_build

    def initialize_without_warmup():
        # Stock initialization restores Settings before importing model_manager.
        phase_a()
        disable_tts_warmup(app)

    app._phase_a_build = initialize_without_warmup


if __name__ == '__main__':
    lock = json.loads((Path(__file__).resolve().parents[1] / 'voicestudio-runtime.lock.json').read_text())
    project = Path(sys.argv[1]).resolve(strict=True)
    backend = verify_runtime(project, lock)
    os.chdir(project)
    sys.path.insert(0, str(backend))
    import main
    install_after_initialization(main)
    import uvicorn
    uvicorn.run(main.app, host='127.0.0.1', port=3900, app_dir=str(backend))
