import asyncio
import os
import tempfile

import edge_tts
import pygame


class TextToSpeech:

    def __init__(self):
        pygame.mixer.init()

    async def _generate_audio(self, text, filename):
        communicate = edge_tts.Communicate(
            text=text,
            voice="en-US-AriaNeural"
        )
        await communicate.save(filename)

    def speak(self, text):
        temp_file = tempfile.NamedTemporaryFile(
            delete=False,
            suffix=".mp3"
        )

        temp_file.close()

        asyncio.run(
            self._generate_audio(text, temp_file.name)
        )

        pygame.mixer.music.load(temp_file.name)
        pygame.mixer.music.play()

        while pygame.mixer.music.get_busy():
            pygame.time.Clock().tick(10)

        pygame.mixer.music.unload()

        os.remove(temp_file.name)