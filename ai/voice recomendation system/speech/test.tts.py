import asyncio
import edge_tts
import pygame
import tempfile
import os


async def generate_audio(text, filename):
    communicate = edge_tts.Communicate(
        text=text,
        voice="en-US-AriaNeural"
    )
    await communicate.save(filename)


def speak(text):
    temp_file = tempfile.NamedTemporaryFile(
        delete=False,
        suffix=".mp3"
    )
    temp_file.close()

    asyncio.run(generate_audio(text, temp_file.name))

    pygame.mixer.init()
    pygame.mixer.music.load(temp_file.name)
    pygame.mixer.music.play()

    while pygame.mixer.music.get_busy():
        pygame.time.Clock().tick(10)

    pygame.mixer.music.unload()
    os.remove(temp_file.name)


if __name__ == "__main__":
    speak("Hello")
    speak("Goodbye. Have a nice day.")