# Touchline: a case study

*How I scoped, decided and shipped an MVP for grassroots football captains, and what I still don't know.*

## The problem, as a hypothesis

Every weekend, thousands of volunteer captains do the same small job: work out who's playing, where, and what the plan is, then get that across to eleven people who mostly read WhatsApp on the way to the pitch. The plan ends up scattered across a group chat, a photo of a whiteboard, and memory. Last month's good idea gets lost, and players arrive with different versions of the instructions.

I want to be careful here: **this is a hypothesis, not research.** I haven't interviewed captains yet. The PRD frames it that way, and the release assessment lists discovery interviews as the first thing to do next. What I could do was make the bet sharp enough to test.

## Where the opportunity is (and isn't)

The obvious move would have been "a better tactics board". But that's crowded: tools like TacticalPad already draw beautiful diagrams and export them. Competing on drawing would have meant building the hardest part of the product just to reach parity.

So the bet is narrower and, I think, more interesting: **continuity**. The squad you enter once flows into this week's lineup. The shape you drew last month is reused against a new opponent. And the whole thing turns into one briefing, frozen at the moment you publish it, that players can open without installing anything. The north-star proxy in the PRD follows from that: *match plans actually presented or shared, per active team, per month.* Plans that never reach the players don't count.

## Scoping: what I chose not to build

Most of the product work was saying no. For the MVP I deliberately left out:

- **Live tracking, video and "AI tactical advice."** Flashy, expensive, and nothing to do with the core loop.
- **Multiple coaches editing together.** Real-time co-editing roughly doubles the complexity of every screen. One owner per team keeps permissions simple, and it matches how most Sunday sides actually work.
- **Animated tactics.** A sequence of static boards explains a move almost as well, for a fraction of the effort.
- **Payments, league admin, availability polls.** All real needs, all a different product.
- **Editing on phones.** The board is desktop-first. On a phone it's view-only, because that's where players *read*, not where captains plan.

## The decisions that shaped the product

The [decision register](../DECISIONS.md) has around fifty entries. These are the ones I'd talk through in an interview.

**1. Publishing freezes a snapshot.** When you publish, Touchline copies exactly what players will see. If you tweak the tactic on Wednesday, the briefing players got on Monday doesn't quietly change under them; you republish deliberately. *Trade-off:* a little friction ("you have unpublished changes") in exchange for players never being confused about which version is current. The same snapshot drives the full-screen presenter, the phone view and the PDF, so the three can never disagree.

**2. Private notes live next to public ones.** Captains have things to say that players shouldn't read ("sub Riley at half time if he's booked"). Rather than a separate notebook, every section has a private note right beside the player-facing one, and the publishing code works from an allowlist that can't include it. The demo seeds one so you can check it's missing from the player view.

**3. You can't publish an incomplete lineup.** A 7v7 briefing with six names is worse than no briefing. Drafts can be as incomplete as you like, but **Publish** stays disabled until the starting lineup matches the format. A checklist explains exactly why, in plain words ("Add all 7 starters before publishing this 7v7 match plan").

**4. Links are private, revocable and invisible to logs.** The player link is the riskiest surface in the product: it's a door with no login. So it's long and random, stored only as a one-way fingerprint, and revocable in one click (the old link then shows "briefing unavailable", exactly like a mistyped one). The less obvious choice: the secret part sits after the `#` in the URL, which browsers never send to servers, so it can't end up in hosting logs. Lookups are rate-limited per visitor.

**5. Players are archived, never deleted.** People leave teams, but old briefings should still say who played. Archiving hides a player from new lineups while past briefings keep their name and number.

**6. The demo is a sandbox, not a shared account.** For people evaluating the product (recruiters included), a shared demo login means someone else's mess, or worse. Each "Try the demo" creates a private, pre-filled team that deletes itself after 24 hours.

**7. Accessibility isn't a phase.** Everything you can do on the canvas has a keyboard or form alternative: an object list, numeric positions, arrow-key nudging. An automated WCAG 2.2 AA check runs across 13 screens, and it caught real contrast problems that I then fixed.

## What I'd measure

The analytics are deliberately small and privacy-safe: counts and formats only, under a random team id, and never names, notes or links ([PLAN-004 §5](../specs/04_Touchline_Delivery_QA_Plan.md)). That's enough to answer the questions that matter in a pilot:

- **Activation:** of teams that sign up, how many save a tactic within a week?
- **Time to first plan:** can a new captain get from sign-up to a published briefing in under ten minutes?
- **Briefing usage** (the north star in miniature): of plans that are completed, how many are actually opened by players or exported?
- **Reuse:** do captains come back the next week and reuse last week's shape?

The PRD sets these as *targets to revise after a baseline*, not as promises.

## Working with an AI engineer

I built Touchline as the product owner, with an AI coding agent writing the code. The interesting part wasn't the speed; it was what kept the work honest.

- **Specs before code.** A PRD with acceptance criteria per requirement, a UX blueprint with every screen and state, a technical spec, a QA plan, and a short brief telling the agent how to work: one vertical slice at a time, no claiming a test passed unless it ran, and log any ambiguity rather than guessing.
- **Phase gates with evidence.** Each of seven phases ended with a written record: the requirements covered, the tests actually run with their results, the bugs found, and screenshots. I decided whether to move on.
- **Decisions stayed with me.** Where to host, whether sign-up needs email confirmation, how to rate-limit public links, which PDF engine to use, how the demo should work. The agent proposed options with trade-offs, and I chose.

Testing caught real problems along the way, which is exactly why the evidence step mattered. A few examples:
- Deleting a team that had any lineup failed outright, because of a database constraint ordering issue. It was found by a seed script, then fixed and regression-tested.
- A first draft of the rate limiter could have been bypassed by calling the database directly. It was caught in review before any test ran.
- The PDF silently dropped letters from names like *Łukasz Żółć*. It was fixed by embedding a proper font, and a test now checks Polish, Irish, Cyrillic and Greek names.
- Opening a second share link in the same browser tab kept showing the first briefing.

## What's still unproven

- **The problem.** No interviews yet. The guide is written ([PLAN-004 §6](../specs/04_Touchline_Delivery_QA_Plan.md)) and these are the next step.
- **The value.** No pilot. The PRD's launch gate asks for three captains completing the task unassisted, and that hasn't happened.
- **Real devices.** Tested in desktop and phone-sized browsers, not on actual phones and tablets.
- **Security.** Extensive automated isolation tests, but no independent review.

The [release assessment](../RELEASE-ASSESSMENT.md) is blunt about all of this. My recommendation there is: good enough to demo and to start a small private beta, not yet good enough to claim it solves the problem.

## What's next

1. Five conversations with captains, using the discovery guide, before building anything else.
2. A three-to-five team pilot, measured with the events above.
3. Depending on what we learn, the next bets are availability ("who can play Saturday?") and a second coach role. Both were deliberately cut from the MVP.
