# Generation workflow

Turn a request into finished files on disk, then report what was made. Every
asset-gen skill follows these steps; the skill itself supplies the prompt rules and
the checks for its asset type.

1. **Classify the request.** Each asset type has its own skill: `image`, `svg`,
   `sound`, `music`, `video`, `3d-model`. When a request spans types (a tap sound and
   background music, an icon plus a splash screen), load the sibling skill for each
   part. A request for several assets of one type (an icon set, a sound pack) is a
   batch: run the generators in parallel Bash calls, and keep the set cohesive with
   the same style words and palette in every prompt.
2. **Pick defaults and state them.** Output goes to the path the user named, else
   `./assets/<kebab-name>.<ext>` in the current project. Choose the size preset or
   duration that fits the use (app icon → `icon`, UI tap → 0.5 s, background music →
   120 s). List these choices under "Assumptions" in the report.
3. **Write the prompt.** Be specific about subject, style, mood, colors, and what to
   leave out, following the skill's prompt rules.
4. **Run, then inspect.** Run the generator and apply the skill's checks to the
   output. Regenerate with a revised prompt when it clearly misses the request, up
   to two retries per asset. Long jobs (video, Meshy pipelines) go to
   `run_in_background` while other assets proceed.
5. **Report**: each file path, its dimensions or duration, the final prompt, any
   post-processing applied, assumptions, and spend where it is metered (Meshy
   credits).

## Temporary files

Intermediate files (raw renders before keying, bitmaps and traces before the final
SVG) go in a directory made with `mktemp -d`, never in the project. Write only the
finished asset into the project, then remove the temp directory with `rm -rf "$T"`
before reporting.
