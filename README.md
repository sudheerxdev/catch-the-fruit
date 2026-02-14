# Fruit Catcher

A polished browser game built with pure HTML, CSS, and JavaScript. Catch falling fruits, build combos, survive misses, and chase your best score.

## Live Demo

Play now: https://sudheerxdev.github.io/fruit-catcher/

## Features

- Smooth gameplay loop using `requestAnimationFrame`
- Progressive difficulty (faster falling speed and spawn rate)
- Multiple fruit types: apple, banana, orange, strawberry
- Random spawn positions
- Score system with combo bonus
- Lives system with game over flow
- Start screen, pause/resume, and game over overlay
- Sound effects for catch, miss, and game over
- Background music with toggle
- High score persistence via `localStorage`
- Particle effects on successful catches
- Power-up fruits: slow motion and double score
- Theme toggle (light/dark)
- Responsive canvas with touch + keyboard controls

## Controls

### Desktop

- `Arrow Left` / `A`: Move basket left
- `Arrow Right` / `D`: Move basket right
- `P` or `Esc`: Pause / Resume
- `Enter` / `Space`: Start or restart

### Mobile / Tablet

- Drag or swipe on the game canvas to move the basket

## Screenshots

Add screenshots here after running the latest UI build.

```md
![Gameplay](assets/screenshots/gameplay.png)
![Game Over](assets/screenshots/game-over.png)
```

## Installation

1. Clone the repository:

```bash
git clone https://github.com/sudheerxdev/fruit-catcher.git
```

2. Go to the project directory:

```bash
cd fruit-catcher
```

3. Open `index.html` in your browser.

No build tools or package installs are required.

## Project Structure

```text
fruit-catcher/
  index.html
  style.css
  script.js
  assets/
    images/
      basket.png
      apple.png
      banana.png
      orange.png
      strawberry.png
      heart.png
      background.png
    sounds/
      catch.mp3
      miss.mp3
      gameover.mp3
      music.mp3
  README.md
```

## Technologies Used

- HTML5
- CSS3
- Vanilla JavaScript (ES6+)
- Canvas API
- Web Audio API

## License

MIT License

## Author

Sudheer Yadav ([sudheerxdev](https://github.com/sudheerxdev))