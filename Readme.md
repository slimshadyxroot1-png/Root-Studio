# Root Studio

*A free music maker that runs in your browser. Make beats, write melodies, record your voice and export the song, with nothing to install.*

<p align="center">
  <img src="screenshots/overview.png" width="800">
</p>

**[Click here to open Root Studio in your browser](https://slimshadyxroot1-png.github.io/Root-Studio/)** (nothing to download)

## Run it

The easy way: open **https://slimshadyxroot1-png.github.io/Root-Studio/** in Chrome or Edge and start making music. You don't have to download anything.

If you want to run it on your own computer, download or clone the repo and open `index.html`.

```
git clone https://github.com/slimshadyxroot1-png/Root-Studio.git
```

If you run it locally, the VS Code Live Server extension is the easiest way, and it makes the microphone and MIDI permissions work better (the online link already does). Wear headphones if you record your voice, or the song leaks into the mic.

## Why I made this

I love music, and I noticed that most DAWs are really expensive. I wanted to make one that anyone can open in a browser tab and start making beats with, without paying for anything.

## How I made it

It took me around 20 hours. I'm a beginner at programming, so I built it with a lot of help from an AI (Claude). I had the idea, decided what features it needed, tested everything and kept asking for more. The AI wrote most of the code.

It's plain HTML, CSS and JavaScript with no libraries. The sound is made with the Web Audio API that is built into the browser. The first version had drum patterns, a piano roll, a synth, a mixer and exporting. After that I kept adding things like effects, a sampler, audio recording, MIDI import and more playlist lanes.

## The hardest part

When I added all the new features, my old saved songs stopped loading properly. Only 4 bars came back out of 32. We had to find out why, and it turned out the new version was ignoring the playlist saved in the old files. It taught me that when you change how a program saves things, the old files can break.

## Quick start

1. Open the app. A basic beat is already loaded.
2. Press **Space** to play.
3. Click the squares in the **Channel rack** to add drum hits.
4. Click in the **Piano roll** to add notes.
5. Change the BPM, swing and master volume at the top.
6. Click **Save** to keep the song, or **Export WAV** to get the audio.

The list on the left has presets (Rock, Techno, Funk, Trap and more) if you don't want to start from nothing.

## How to make a beat

This is how I'd go from an empty song to a full beat. The first time it takes maybe 15 minutes. Most panels start folded, so click a panel's title to open it.

**1. Start empty.** Click **Empty** in the list on the left. Set the **BPM** at the top (around 90 is slow and bouncy, 140 is fast and hard). In the **Channel rack** pick a **Drum kit**: Retro, 80s or Acoustic.

**2. Drums.** Every row in the Channel rack is a drum, and one row of squares is one bar. The numbers 1, 2, 3, 4 above the squares are the beats. Click squares to turn hits on, or click and drag to paint a whole row.

- Kick on beats 1 and 3 (the 1st and 9th square)
- Snare or clap on beats 2 and 4 (the 5th and 13th square)
- Hi-hat on every second square

Click a drum's name to hear it. Raise **Swing** at the top if it feels too stiff.

**3. Make the pattern longer.** Open the **Playlist** panel and change **Length** to 4 bars. Now the rack has four rows of beats to fill, so you can add little changes instead of repeating one bar.

**4. Bass.** In the **Piano roll**, the track dropdown at the top starts on Track 1. Open the **Synthesizer** panel, click **Load preset** and pick **Bass**. Choose a **Key** and a **scale** (for example E and Minor). The roll shows which notes are in the scale. Click cells low in the roll to draw bass notes, try one note per beat. Click the piano keys on the left to hear a note before you place it.

**5. Chords.** Click the **+** next to the track name to add a track and rename it (Piano, Strings, whatever). Load a preset like **Pad** or **Pluck**. Then pick a progression in the **Chords** dropdown and press **Insert**. It fills the track with chords in your key. This replaces everything on that track, so do it on an empty one.

**6. Melody.** Add one more track with the **Lead** preset. You can draw notes in the roll, or turn on **Rec** (set **Count-in** to 1 bar first), press play and play with the keys Z, S, X, D, C, V... on your computer keyboard. If it sounds sloppy, press **Quantize**.

**7. Mix it.** Open the **Mixer** panel. Drums and bass usually go loud, pads and strings quiet. Add a bit of reverb to the chords and melody. A trick I like: set the bass strip's effect to **sidechain**, so the bass ducks every time the kick hits.

**8. Make more patterns.** Open the **Playlist**, press **Clone** to copy your pattern, then change it: take the drums out for a break, add hats for a hook. Use **Rename** to call them Intro, Verse, Hook and so on.

**9. Build the song.** Pick a pattern in the **Pattern** dropdown, then click bars in the playlist to paint it in. A 4 bar pattern fills 4 bars. Press the **Pattern mode** button so it says **Song mode** and hit **Space** to hear the whole thing. To loop one part while you work on it, click its first bar number, Shift+click the last one and press **Loop**.

**10. Save and export.** Click **Save** to keep the song file, and **Export WAV** to get the audio.

To see how a finished song is built, open **West Coast Original** from the `beats` folder. It's 93 BPM with a bit of swing, with four tracks (Piano, Whistle, Bass, Strings) and four patterns (Intro, Verse, Hook, Break). The playlist plays Intro, a long Verse (8 bars), Hook, Verse, Break, Hook and Intro again, and the bass uses the sidechain effect. Click through the patterns and the panels to see how each part was done.

A few small tricks:

- **Ctrl+Z** undoes mistakes. It's your best friend.
- The **velocity lane** at the bottom of the piano roll makes some notes louder than others, and it makes a beat sound much more human.
- **Euclid** (in the Channel rack) fills a drum row with a cool rhythm in one click.
- Use the **Metronome** if you're recording and need the beat.

## What's inside

Click the title of any panel to fold it.

<p align="center">
  <img src="screenshots/playlist.png" width="700">
</p>

**Playlist.** Turn patterns into a whole song. There are four lanes that play at the same time and 128 bars. You can loop a part, and you can draw automation under the bars, even tempo changes.

<p align="center">
  <img src="screenshots/drums.png" width="700">
</p>

**Drums.** Six drums to start, up to 12. You can load your own samples, change pitch and length, and make drums cut each other off (like a closed hi-hat stopping an open one). Each hit can have its own velocity, chance of playing, roll and small timing shift.

<p align="center">
  <img src="screenshots/piano-roll.png" width="700">
</p>

**Piano roll.** Draw notes, pick a key and scale so you can see which notes fit, insert chord progressions, and snap to triplets and 1/32 notes. Play it with your computer keyboard (Z, S, X, D, C, V...) or a MIDI keyboard. Turn on **Rec** to record what you play.

<p align="center">
  <img src="screenshots/synth.png" width="700">
</p>

**Synthesizer.** Two oscillators, a sub, noise, a filter, an LFO and presets. A track can also be a sampler that plays your own sound at any pitch.

<p align="center">
  <img src="screenshots/mixer.png" width="700">
</p>

**Mixer.** Volume, pan, EQ, a compressor, reverb and delay sends, two effects and group buses for every track. There's also a master section on the right.

**Audio tracks.** Record from the microphone or load audio files, then cut, stretch, fade and reverse them. With a loop on, every pass you record becomes its own take.

## Example beats

The `beats` folder has three beats I already made. Each one comes as a `.json` song and as a `.wav` file.

| Beat | BPM |
|---|---|
| Drill Nights | 140 |
| Midnight Keys | 64 |
| West Coast Original | 93 |

- **Just listen:** play the `.wav` file on your computer or phone, no app needed.
- **Play with it:** open Root Studio, click **Open** and pick one of the `.json` files (or drag it onto the page). Then press **Song mode** and **Space** to hear the whole song, and change anything you like.

## Saving and exporting

- **Save** downloads a `.json` file with the whole song and its audio. **Open** (or dragging the file onto the page) loads it again.
- **Save as...** lets you pick a file once, and then **Ctrl+S** saves straight to it.
- **Save to browser** keeps several songs inside the browser. The app also autosaves your song, but that is only a safety net.
- **Export** gives you WAV, MP3, OGG, stems (one file per track) or a MIDI file. You can also **Import MIDI**.

The MP3 encoder is loaded from the internet, so use WAV when you're offline.

## Shortcuts

| Keys | What it does |
|---|---|
| Space | Play / pause |
| Ctrl+Z / Ctrl+Y | Undo / redo |
| Ctrl+S | Save |
| Z S X D C V G B H N J M | Play notes |
| [ and ] | Change octave |
| ? | Open the help window |

## Things it can't do yet

- Change the time signature in the middle of a song
- Export FLAC
- Use MP3 export without an internet connection

## License

[MIT](LICENSE). Free for everyone to use, change and share however they want.
