---
name: First Round
description: One sheet on a dark blotter. The letter is the page.
colors:
  blotter: '#171614'
  lamp: '#2a241c'
  sheet: '#f4efe6'
  ink: '#1c1916'
  quiet: '#3f382f'
  rule: '#ddd4c6'
  wax: '#9d3b28'
  wax-ink: '#f6f1e8'
  wax-hover: '#862f1f'
  colophon: '#cfc6b8'
typography:
  display:
    fontFamily: 'Google Sans Variable, Google Sans, sans-serif'
    fontSize: 'clamp(2.7rem, 7.4vw, 5.15rem)'
    fontWeight: 520
    lineHeight: 0.96
    letterSpacing: '-0.035em'
  body:
    fontFamily: 'Google Sans Variable, Google Sans, sans-serif'
    fontSize: '1.2rem'
    fontWeight: 450
    lineHeight: 1.45
    letterSpacing: '-0.015em'
rounded:
  none: '0px'
  mark: '999px'
spacing:
  sheet: 'clamp(1.5rem, 4vw, 2.75rem)'
  beat: '4.5rem'
components:
  button-seat:
    backgroundColor: '{colors.wax}'
    textColor: '{colors.wax-ink}'
    rounded: '{rounded.none}'
    padding: '0.75rem 1.1rem'
  button-seat-hover:
    backgroundColor: '{colors.wax-hover}'
    textColor: '{colors.wax-ink}'
  field:
    backgroundColor: 'transparent'
    textColor: '{colors.ink}'
    rounded: '{rounded.none}'
    padding: '0.7rem 0.1rem'
---

# First Round

## Overview

The public page is a sheet of paper on a dark desk. Google Sans is the only face. Wax red is the traveling mark and the one button. Status is a sentence, never a pill.

## Colors

The blotter is the room. The sheet is the only light object. Quiet text is ink, darkened, not gray. Wax appears twice: the dot on the day line, and Hold a seat.

## Typography

Google Sans Variable, self-hosted from the OFL package. Display is tight and large, at most about 5.15rem. Body sits near 1.2rem on a measure inside the sheet. No second typeface, no eyebrow, no caption style under every heading.

## Layout

A centered sheet, max about 46rem, with blotter around it. The first viewport holds the sentence at the top of the sheet and the email field at the bottom. The letter continues in the same sheet: a sort, one kept role, the sample letter, then Sent, Quiet, Nudge, Answer. The paper fold sits in a dark well at the end of that line.

After the opening, a route diagram contrasts the application queue with the reviewed letter's path to the recruiting head. The mobile layout preserves the same story in a vertical sequence.

## Components

The field is an underline, not a box. The button is a wax rectangle with square corners. The kept role is a drawn ring. Discarded roles get a hairline strike. The day mark is an 11px wax dot on a rule.

## Motion

Scroll draws the strikes, the ring, and the wax dot. A single folded sheet in the dark well turns as the dot travels. Reduced motion shows the strikes, the ring, and the dot already at the end, and does not mount the 3D scene.

The resume splits into two continuously moving paths: the usual application queue and First Round's reviewed letter to the recruiting head. The head's marker flashes green when the letter arrives. Reduced motion keeps both paths and their steps visible, but stops the flow, paper markers, and arrival flash.

## Do

- Keep new screens on the blotter and the sheet.
- Use words for state: Waiting, Sent, Replied, Quiet.
- Put the next action in the first view of a persuasive page.

## Don't

- No em dashes in copy.
- No eyebrows, icon cards, gradient text, or green and red pills.
- No invented counts, logos, or testimonials.
