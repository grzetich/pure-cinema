# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pure Cinema is a Visual Studio Code extension that provides terminal recording capabilities similar to asciinema, but integrated directly into VS Code. The project aims to serve software developers who want an easy way to record terminal sessions without complex setup requirements.

## Core Requirements

Based on the PRD (docs/prd.md), the project must deliver:

1. **Cross-platform compatibility** - Support all operating systems that VS Code supports
2. **Compact file format** - Recordings should be stored efficiently 
3. **Text copyability** - Viewers must be able to copy text from recordings
4. **VS Code integration** - Recording functionality embedded within the editor

## Development Setup

### Commands
- `npm install` - Install dependencies
- `npm run compile` - Compile TypeScript to JavaScript
- `npm run watch` - Compile in watch mode for development
- `npm run lint` - Run ESLint on source code
- `npm run test` - Run all tests
- `npm run pretest` - Compile and lint before running tests

### Development Workflow
- Use `npm run watch` for continuous compilation during development
- Press F5 in VS Code to launch extension development host
- Run tests with `npm test` to ensure code quality
- Extension requires VS Code 1.74.0 or higher

## Architecture Considerations

When implementing the terminal recording functionality:

- Integrate with VS Code's integrated terminal API to capture terminal output
- Design a compact binary or text-based format for storing terminal sessions with timing information
- Create a custom viewer/player that can render recorded sessions with copy functionality
- Consider how to handle different terminal types, colors, and escape sequences

## Target Users

The extension targets "vibe coders" and developers without deep technical experience who may struggle with WSL setup or command-line tools like asciinema.