# LullDiary Claude Rules

## CRITICAL — User statements must not be fabricated

- Never claim that the user said, requested, decided, preferred, or previously confirmed something unless that statement is explicitly present in the current conversation or an authoritative project file.
- Never invent prior conversations.
- Never invent user preferences.
- Never write "you previously said...", "as you requested before...", "we decided...", or equivalent statements unless the source can be verified.
- Never treat Claude's own previous assumption as a fact about the user.
- Never convert an inference into a user requirement.
- If the source of a requirement cannot be verified, treat it as unknown.
- When uncertain, say that it is unknown instead of guessing.

## CRITICAL — Do not expand the task

- Do only what the user asks.
- Do not add unrequested features.
- Do not refactor unrelated code.
- Do not change existing behavior without a direct reason.
- Do not create additional work merely because it might be useful.

## CRITICAL — Facts, assumptions, and proposals

Always distinguish:

- FACT: verified from the current conversation or project files.
- ASSUMPTION: not verified.
- PROPOSAL: an optional suggestion.

Never present ASSUMPTION or PROPOSAL as FACT.

## Communication

- Answer the user's actual question first.
- Do not repeat information already established.
- Do not provide unnecessary explanations.
- Do not ask confirmation when the request is already sufficiently clear.
- Do not generate hypothetical dialogue as though the user actually said it.
