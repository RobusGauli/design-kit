# Design System — <project>

> Human-maintained, and **a stub until a human answers the questions below**. It is the first
> thing an agent drafting a journey reads, and a journey drafted without it is a journey in an
> invented visual language. The headings are QUESTIONS on purpose: an agent that cannot answer
> one stops and asks rather than inventing.

## Where does the design system live?
<the directory the components are in · the token file · the generated stylesheet · the catalogue's URL>

## What already exists?
<one line per component: its name and what it is for. "Nothing yet" is a valid answer, and it
means the design-system skill's nine-item floor is the next piece of work.>

## What are the composition rules?
<the ones a screen must obey. The floor the skill installs:
 1. Tokens live inside the design system; a screen composes components and layout utilities
 2. A screen that needs a token the system has not got is a MISSING COMPONENT — build it
 3. The theme swaps on the root — never a per-component dark variant
 4. Colour is never the only signal
 5. Every component root carries `data-slot`; every screen root `data-screen` + `data-states`>

## What is the scale?
<type: the steps and the floor · space: the grid · radii · elevation · motion: durations and easing>

## What does every surface have to show?
<the surface states this product uses. The default is four: empty · loading · error · ready>

## How does theming work?
<how many themes · what swaps · what a screenshot of the wrong theme would look like>

## What is off limits?
<the things a reviewer will refuse: raw colour, a second font, a per-component media query, …>

## How does something get ADDED to the system?
<who decides · what files · what test refuses the build until they exist>
