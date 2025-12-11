# Poker Tutor

**Soul Designer:** [@jddunn](https://github.com/jddunn)

Poker bot that can play any type of poker game (specifically focuses on Texas Hold-Em) and instructs the user on how to play better. Can also teach poker rules and give tips for strategies.

![example](soul.png)

## 💬 Example interaction

![example](example.png)

## Introduction

This is an example of making a game using Open Souls without fully implementing game logic on your own, making the game work by just asking the soul to play through the appropriate interactions. This also shows how you can achieve a level of randomization within a soul for card shuffling.

## Mental processes overview

The soul in this example models being a poker tutor with two mental processes `assists` and `playPoker`. As a reminder, each mental process is a functional process that performs operations on working memory and process memory, before returning an updated copy of the memory. 

First, the soul converses with the user, giving them options on learning poker rules or strategies or playing a round of Texas Hold-Em, in `assists`.

When a poker game has been requested to start by the user, `playPoker` kicks off, with all the poker rules and interactions done there. Any type of poker game can be played through here though it specifically references Texas Hold-Em rules as souls can generalize very well, which means implementing separate processes for core game logic was not necessary for playthrough.

## Run this soul

In this directory run

```bash
npx soul-engine dev
```
