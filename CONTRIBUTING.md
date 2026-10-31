# Contributing to Jarvis Video Studio

Thank you for your interest in contributing! Jarvis Video Studio is an open-source, code-driven video production workbench.

## Development Setup

1. Clone your fork of the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/jarvis-video-studio.git
   cd jarvis-video-studio
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the automated test suite:
   ```bash
   npm test
   ```
4. Start the development server:
   ```bash
   npm start
   ```
   Open `http://127.0.0.1:20130` in your browser.

## Guidelines

- **Test-Driven Development**: When adding a new feature or fixing an issue, please write an automated unit or integration test verifying the behavior first.
- **Pure Local Execution**: Features must never send private user narration, media, or tokens to third-party endpoints without explicit user opt-in.
- **Maintainable Standards**: Use ES Modules (`.mjs`), keep functions modular, and avoid bloated runtime dependencies.
- **Submitting Pull Requests**: Ensure all tests pass (`npm test`) before submitting.