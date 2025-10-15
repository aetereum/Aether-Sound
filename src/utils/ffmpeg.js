const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

function isFfmpegAvailable() {
  try {
    const res = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
    return res.status === 0 || (res.stdout && res.stdout.includes('ffmpeg')) || (res.stderr && res.stderr.includes('ffmpeg'));
  } catch (e) {
    return false;
  }
}

function convertWavToMp3(wavPath, mp3Path) {
  // ffmpeg -y -i input.wav -vn -ar 44100 -ac 2 -b:a 192k output.mp3
  const args = ['-y', '-i', wavPath, '-vn', '-ar', '44100', '-ac', '2', '-b:a', '192k', mp3Path];
  const res = spawnSync('ffmpeg', args, { stdio: 'inherit' });
  if (res.status !== 0) throw new Error('ffmpeg mp3 conversion failed');
  return mp3Path;
}

function convertWavToMp4(wavPath, mp4Path, options = {}) {
  // Create a simple video with a color background and the audio
  // ffmpeg -y -f lavfi -i color=size=1280x720:color=black -i audio.wav -c:v libx264 -c:a aac -b:a 192k -shortest out.mp4
  const width = options.width || 1280;
  const height = options.height || 720;
  const color = options.color || 'black';
  const args = ['-y', '-f', 'lavfi', '-i', `color=size=${width}x${height}:color=${color}`, '-i', wavPath, '-c:v', 'libx264', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-pix_fmt', 'yuv420p', mp4Path];
  const res = spawnSync('ffmpeg', args, { stdio: 'inherit' });
  if (res.status !== 0) throw new Error('ffmpeg mp4 conversion failed');
  return mp4Path;
}

module.exports = { isFfmpegAvailable, convertWavToMp3, convertWavToMp4 };
