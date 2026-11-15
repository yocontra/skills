# Humanizer: Full Pattern Catalog

33 categories of readability problems with words-to-watch lists and before/after examples, plus positive habits to write toward. Patterns 1–25 target AI tics; 26–33 come from editorial linters (Vale and its Microsoft, Google, write-good, and proselint style packages) and apply to any draft.

---

## CONTENT PATTERNS

### 1. Undue Emphasis on Significance, Legacy, and Broader Trends

**Words to watch:** stands/serves as, is a testament/reminder, a vital/significant/crucial/pivotal/key role/moment, underscores/highlights its importance/significance, reflects broader, symbolizing its ongoing/enduring/lasting, contributing to the, setting the stage for, marking/shaping the, represents/marks a shift, key turning point, evolving landscape, focal point, indelible mark, deeply rooted

**Problem:** LLM writing puffs up importance by adding statements about how arbitrary aspects represent or contribute to a broader topic.

**Before:**
> The Statistical Institute of Catalonia was officially established in 1989, marking a pivotal moment in the evolution of regional statistics in Spain. This initiative was part of a broader movement across Spain to decentralize administrative functions and enhance regional governance.

**After:**
> The Statistical Institute of Catalonia was established in 1989 to collect and publish regional statistics independently from Spain's national statistics office.

---

### 2. Undue Emphasis on Notability and Media Coverage

**Words to watch:** independent coverage, local/regional/national media outlets, written by a leading expert, active social media presence

**Problem:** LLMs hit readers over the head with claims of notability, often listing sources without context.

**Before:**
> Her views have been cited in The New York Times, BBC, Financial Times, and The Hindu. She maintains an active social media presence with over 500,000 followers.

**After:**
> In a 2024 New York Times interview, she argued that AI regulation should focus on outcomes rather than methods.

---

### 3. Superficial Analyses with -ing Endings

**Words to watch:** highlighting/underscoring/emphasizing..., ensuring..., reflecting/symbolizing..., contributing to..., cultivating/fostering..., encompassing..., showcasing...

**Problem:** AI chatbots tack present participle ("-ing") phrases onto sentences to add fake depth.

**Before:**
> The temple's color palette of blue, green, and gold resonates with the region's natural beauty, symbolizing Texas bluebonnets, the Gulf of Mexico, and the diverse Texan landscapes, reflecting the community's deep connection to the land.

**After:**
> The temple uses blue, green, and gold colors. The architect said these were chosen to reference local bluebonnets and the Gulf coast.

---

### 4. Promotional and Advertisement-like Language

**Words to watch:** boasts a, vibrant, rich (figurative), profound, enhancing its, showcasing, exemplifies, commitment to, natural beauty, nestled, in the heart of, groundbreaking (figurative), renowned, breathtaking, must-visit, stunning

**Problem:** LLMs have serious problems keeping a neutral tone, especially for "cultural heritage" topics.

**Before:**
> Nestled within the breathtaking region of Gonder in Ethiopia, Alamata Raya Kobo stands as a vibrant town with a rich cultural heritage and stunning natural beauty.

**After:**
> Alamata Raya Kobo is a town in the Gonder region of Ethiopia, known for its weekly market and 18th-century church.

---

### 5. Vague Attributions and Weasel Words

**Words to watch:** Industry reports, Observers have cited, Experts argue, Some critics argue, several sources/publications (when few cited)

**Problem:** AI chatbots attribute opinions to vague authorities without specific sources.

**Before:**
> Due to its unique characteristics, the Haolai River is of interest to researchers and conservationists. Experts believe it plays a crucial role in the regional ecosystem.

**After:**
> The Haolai River supports several endemic fish species, according to a 2019 survey by the Chinese Academy of Sciences.

---

### 6. Outline-like "Challenges and Future Prospects" Sections

**Words to watch:** Despite its... faces several challenges..., Despite these challenges, Challenges and Legacy, Future Outlook

**Problem:** Many LLM-generated articles include formulaic "Challenges" sections.

**Before:**
> Despite its industrial prosperity, Korattur faces challenges typical of urban areas, including traffic congestion and water scarcity. Despite these challenges, with its strategic location and ongoing initiatives, Korattur continues to thrive as an integral part of Chennai's growth.

**After:**
> Traffic congestion increased after 2015 when three new IT parks opened. The municipal corporation began a stormwater drainage project in 2022 to address recurring floods.

---

## LANGUAGE AND GRAMMAR PATTERNS

### 7. Overused "AI Vocabulary" Words

**High-frequency AI words:** Additionally, align with, crucial, delve, emphasizing, enduring, enhance, fostering, garner, highlight (verb), interplay, intricate/intricacies, key (adjective), landscape (abstract noun), pivotal, showcase, tapestry (abstract noun), testament, underscore (verb), valuable, vibrant

**Problem:** These words appear far more frequently in post-2023 text. They often co-occur.

**Before:**
> Additionally, a distinctive feature of Somali cuisine is the incorporation of camel meat. An enduring testament to Italian colonial influence is the widespread adoption of pasta in the local culinary landscape, showcasing how these dishes have integrated into the traditional diet.

**After:**
> Somali cuisine also includes camel meat, which is considered a delicacy. Pasta dishes, introduced during Italian colonization, remain common, especially in the south.

---

### 8. Avoidance of "is"/"are" (Copula Avoidance)

**Words to watch:** serves as/stands as/marks/represents [a], boasts/features/offers [a]

**Problem:** LLMs substitute elaborate constructions for simple copulas.

**Before:**
> Gallery 825 serves as LAAA's exhibition space for contemporary art. The gallery features four separate spaces and boasts over 3,000 square feet.

**After:**
> Gallery 825 is LAAA's exhibition space for contemporary art. The gallery has four rooms totaling 3,000 square feet.

---

### 9. Negative Parallelisms

**Problem:** Constructions like "Not only...but..." or "It's not just about..., it's..." are overused.

**Before:**
> It's not just about the beat riding under the vocals; it's part of the aggression and atmosphere. It's not merely a song, it's a statement.

**After:**
> The heavy beat adds to the aggressive tone.

---

### 10. Rule of Three Overuse

**Problem:** LLMs force ideas into groups of three to appear comprehensive.

**Before:**
> The event features keynote sessions, panel discussions, and networking opportunities. Attendees can expect innovation, inspiration, and industry insights.

**After:**
> The event includes talks and panels. There's also time for informal networking between sessions.

---

### 11. Elegant Variation (Synonym Cycling)

**Problem:** AI has repetition-penalty code causing excessive synonym substitution.

**Before:**
> The protagonist faces many challenges. The main character must overcome obstacles. The central figure eventually triumphs. The hero returns home.

**After:**
> The protagonist faces many challenges but eventually triumphs and returns home.

---

### 12. False Ranges

**Problem:** LLMs use "from X to Y" constructions where X and Y aren't on a meaningful scale.

**Before:**
> Our journey through the universe has taken us from the singularity of the Big Bang to the grand cosmic web, from the birth and death of stars to the enigmatic dance of dark matter.

**After:**
> The book covers the Big Bang, star formation, and current theories about dark matter.

---

## STYLE PATTERNS

### 13. Em Dash Overuse

**Problem:** LLMs use em dashes (—) more than humans, mimicking "punchy" sales writing.

**Before:**
> The term is primarily promoted by Dutch institutions—not by the people themselves. You don't say "Netherlands, Europe" as an address—yet this mislabeling continues—even in official documents.

**After:**
> The term is primarily promoted by Dutch institutions, not by the people themselves. You don't say "Netherlands, Europe" as an address, yet this mislabeling continues in official documents.

---

### 14. Overuse of Boldface

**Problem:** AI chatbots emphasize phrases in boldface mechanically.

**Before:**
> It blends **OKRs (Objectives and Key Results)**, **KPIs (Key Performance Indicators)**, and visual strategy tools such as the **Business Model Canvas (BMC)** and **Balanced Scorecard (BSC)**.

**After:**
> It blends OKRs, KPIs, and visual strategy tools like the Business Model Canvas and Balanced Scorecard.

---

### 15. Inline-Header Vertical Lists

**Problem:** AI outputs lists where items start with bolded headers followed by colons.

**Before:**
> - **User Experience:** The user experience has been significantly improved with a new interface.
> - **Performance:** Performance has been enhanced through optimized algorithms.
> - **Security:** Security has been strengthened with end-to-end encryption.

**After:**
> The update improves the interface, speeds up load times through optimized algorithms, and adds end-to-end encryption.

---

### 16. Title Case in Headings

**Problem:** AI chatbots capitalize all main words in headings.

**Before:**
> ## Strategic Negotiations And Global Partnerships

**After:**
> ## Strategic negotiations and global partnerships

---

### 17. Emojis

**Problem:** AI chatbots often decorate headings or bullet points with emojis.

**Before:**
> Launch Phase: The product launches in Q3
> Key Insight: Users prefer simplicity
> Next Steps: Schedule follow-up meeting

**After:**
> The product launches in Q3. User research showed a preference for simplicity. Next step: schedule a follow-up meeting.

---

### 18. Curly Quotation Marks

**Problem:** ChatGPT uses curly quotes ("\u2026") instead of straight quotes ("...").

**Before:**
> He said \u201cthe project is on track\u201d but others disagreed.

**After:**
> He said "the project is on track" but others disagreed.

---

## COMMUNICATION PATTERNS

### 19. Collaborative Communication Artifacts

**Words to watch:** I hope this helps, Of course!, Certainly!, You're absolutely right!, Would you like..., let me know, here is a...

**Problem:** Text meant as chatbot correspondence gets pasted as content.

**Before:**
> Here is an overview of the French Revolution. I hope this helps! Let me know if you'd like me to expand on any section.

**After:**
> The French Revolution began in 1789 when financial crisis and food shortages led to widespread unrest.

---

### 20. Knowledge-Cutoff Disclaimers

**Words to watch:** as of [date], Up to my last training update, While specific details are limited/scarce..., based on available information...

**Problem:** AI disclaimers about incomplete information get left in text.

**Before:**
> While specific details about the company's founding are not extensively documented in readily available sources, it appears to have been established sometime in the 1990s.

**After:**
> The company was founded in 1994, according to its registration documents.

---

### 21. Sycophantic/Servile Tone

**Problem:** Overly positive, people-pleasing language.

**Before:**
> Great question! You're absolutely right that this is a complex topic. That's an excellent point about the economic factors.

**After:**
> The economic factors you mentioned are relevant here.

---

## FILLER AND HEDGING

### 22. Filler Phrases

**Before -> After:**
- "In order to achieve this goal" -> "To achieve this"
- "Due to the fact that it was raining" -> "Because it was raining"
- "At this point in time" -> "Now"
- "In the event that you need help" -> "If you need help"
- "The system has the ability to process" -> "The system can process"
- "It is important to note that the data shows" -> "The data shows"

---

### 23. Excessive Hedging

**Problem:** Over-qualifying statements.

**Before:**
> It could potentially possibly be argued that the policy might have some effect on outcomes.

**After:**
> The policy may affect outcomes.

---

### 24. Generic Positive Conclusions

**Problem:** Vague upbeat endings.

**Before:**
> The future looks bright for the company. Exciting times lie ahead as they continue their journey toward excellence. This represents a major step in the right direction.

**After:**
> The company plans to open two more locations next year.

---

### 25. Quantitative Filler

**Words to watch:** X unit tests, N files updated, N new endpoints, N components, added N methods

**Problem:** Counting things instead of describing them. Numbers like "25 unit tests", "14 files updated", "3 new endpoints" are padding. They tell you how many but not what or why. Describe what the tests cover or what the endpoints do, not how many there are.

**Before:**
> This PR adds 25 unit tests, updates 14 files, and introduces 3 new endpoints. We also fixed 7 bugs and refactored 4 modules.

**After:**
> This PR adds test coverage for the payment flow, fixes a race condition in the queue worker, and adds endpoints for user export. The billing module was refactored to separate validation from processing.

---

## PROSE-LEVEL PATTERNS

These come from editorial linters (Vale and the style packages it ships — Microsoft, Google, write-good, proselint). They catch bad writing in general, not just AI tics, and they apply to anyone's draft.

### 26. Passive Voice

**Words to watch:** was/were/is/are/been + past participle with an implied or trailing "by" — "was implemented by," "is handled by the worker," "errors are logged," "the file was deleted"

**Problem:** Passive voice hides who does what and adds words. Name the actor and use an active verb. (This is about passive *constructions* — plain linking verbs like "the API is fast" are fine; see pattern 8.)

**Before:**
> The migration was run by the deploy script. Stale entries are removed by a nightly job. It was decided that the cache would be cleared.

**After:**
> The deploy script runs the migration. A nightly job removes stale entries. We cleared the cache.

---

### 27. Weasel Words and Intensifiers

**Words to watch:** very, quite, really, extremely, fairly, clearly, obviously, surprisingly, remarkably, significantly, substantially, largely, mostly, relatively, usually, several, various, vast, huge, tiny, a number of

**Problem:** Intensifiers and vague quantifiers inflate without informing. "Very fast" isn't faster than "fast." "Clearly" and "obviously" assert instead of showing. Cut the modifier or replace it with a number.

**Before:**
> The new endpoint is very fast and handles a significant number of requests. Obviously, this is a substantial improvement.

**After:**
> The new endpoint responds in 40ms and handles 10k requests per second, down from 600ms.

---

### 28. Inflated Diction

**Problem:** Long Latinate words used where a plain one works. This is pattern 22's filler at the word level. Prefer the shorter word.

**Common swaps:**
- utilize -> use
- leverage -> use
- facilitate -> help
- commence -> start
- terminate -> end
- ascertain -> find out
- endeavor -> try
- demonstrate -> show
- sufficient -> enough
- numerous -> many
- prior to -> before
- subsequent to -> after
- in the event that -> if
- for the purpose of -> to
- methodology -> method (when you just mean "method")

**Before:**
> We will utilize this methodology to facilitate the migration prior to the deadline.

**After:**
> We'll use this method to help the migration before the deadline.

**Full "too wordy" list (write-good).** Each of these is flagged as wordy. Some have a one-word replacement (above); others you just cut or rephrase. The point isn't to ban every word — it's to notice when you reached for the long one out of habit.

a number of, abundance, accede to, accelerate, accentuate, accompany, accomplish, accorded, accrue, acquiesce, acquire, additional, adjacent to, adjustment, admissible, advantageous, adversely impact, advise, aforementioned, aggregate, aircraft, all of, all things considered, alleviate, allocate, along the lines of, already existing, alternatively, amazing, ameliorate, anticipate, apparent, appreciable, as a matter of fact, as a means of, as far as I'm concerned, as of yet, as to, as yet, ascertain, assistance, at the present time, at this time, attain, attributable to, authorize, because of the fact that, belated, benefit from, bestow, by means of, by virtue of, by virtue of the fact that, cease, close proximity, commence, comply with, concerning, consequently, consolidate, constitutes, demonstrate, depart, designate, discontinue, due to the fact that, each and every, economical, eliminate, elucidate, employ, endeavor, enumerate, equitable, equivalent, evaluate, evidenced, exclusively, expedite, expend, expiration, facilitate, factual evidence, feasible, finalize, first and foremost, for all intents and purposes, for the most part, for the purpose of, forfeit, formulate, have a tendency to, honest truth, however, if and when, impacted, implement, in a manner of speaking, in a timely manner, in a very real sense, in accordance with, in addition, in all likelihood, in an effort to, in between, in excess of, in lieu of, in light of the fact that, in many cases, in my opinion, in order to, in regard to, in some instances, in terms of, in the case of, in the event that, in the final analysis, in the nature of, in the near future, in the process of, inception, incumbent upon, indicate, indication, initiate, irregardless, is applicable to, is authorized to, is responsible for, it is, it is essential, it seems that, it was, magnitude, maximum, methodology, minimize, minimum, modify, monitor, multiple, necessitate, nevertheless, not certain, not many, not often, not unless, not unlike, notwithstanding, null and void, numerous, objective, obligate, obtain, on the contrary, on the other hand, one particular, optimum, overall, owing to the fact that, participate, particulars, pass away, pertaining to, point in time, portion, possess, preclude, previously, prior to, prioritize, procure, proficiency, provided that, purchase, put simply, readily apparent, refer back, regarding, relocate, remainder, remuneration, requirement, reside, residence, retain, satisfy, shall, should you wish, similar to, solicit, span across, strategize, subsequent, substantial, successfully complete, sufficient, terminate, the month of, the point I am trying to make, therefore, time period, took advantage of, transmit, transpire, type of, until such time as, utilization, utilize, validate, various different, what I mean to say is, whether or not, with respect to, with the exception of, witnessed

---

### 29. Clichés

**Words to watch:** at the end of the day, low-hanging fruit, think outside the box, move the needle, boil the ocean, needle in a haystack, back to square one, cut to the chase, tip of the iceberg, can of worms, on the same page, best of both worlds, paradigm shift, game changer

**Problem:** Clichés are stock phrases the reader skims past. Say the actual thing.

**Before:**
> At the end of the day, we picked the low-hanging fruit to move the needle.

**After:**
> We fixed the three slowest queries first because they were cheap and accounted for most of the latency.

---

### 30. Weak Sentence Openers

**Words to watch:** "There is," "There are," "It is," sentences starting with "So,"

**Problem:** "There is / There are" buries the subject and pads the sentence. Leading with "So," is a verbal tic. Start with the actor or the point.

**Before:**
> There are three services that depend on this config. So, we need to update all of them.

**After:**
> Three services depend on this config, so update all of them.

---

### 31. Latin Abbreviations

**Problem:** In prose, "e.g.," "i.e.," and "etc." make the reader translate. Spell them out (or restructure).

**Swaps:**
- e.g. -> for example
- i.e. -> that is
- etc. -> and so on (or just end the list)

**Before:**
> Pass any scalar (e.g. a string, int, etc.) and it serializes fine, i.e. no wrapper needed.

**After:**
> Pass any scalar — a string or an int, for example — and it serializes fine. You don't need a wrapper.

---

### 32. Condescending Qualifiers

**Words to watch:** simply, just, easy, easily, obviously, of course, clearly, trivially, as everyone knows

**Problem:** Telling the reader a step is "easy" or "obvious" doesn't make it so — it just makes them feel bad when they're stuck. Drop the word and describe the step.

**Before:**
> Simply run the migration — it's easy. Obviously you'll want to back up first.

**After:**
> Run the migration. Back up the database first.

---

### 33. Skunked and Misused Terms

**Words to watch:** decimate, comprise (vs. "compose"), hopefully (as a sentence adverb), fulsome, deceptively, literally (figurative), begs the question (to mean "raises the question")

**Problem:** "Skunked" terms have a disputed meaning, so any use distracts part of your audience. Pick an unambiguous word.

**Before:**
> The outage decimated throughput, and hopefully the fix comprises all the edge cases.

**After:**
> The outage cut throughput by 90%, and I think the fix covers all the edge cases.

---

## POSITIVE PRACTICES

The patterns above are things to cut. These are things to do — habits from the Microsoft and Google style guides that make prose read like a person wrote it.

**Use contractions.** "Don't," "it's," "you'll," "we're." Spelled-out forms ("do not," "it is") read stiff and formal. Contractions are how people talk.

**Be consistent, don't vary.** This is the flip side of pattern 11. Once you pick a term ("user," "email," "endpoint"), reuse the same word every time. Consistency aids comprehension; synonym-cycling for variety's sake confuses.

**Prefer present tense.** "The function returns X," not "The function will return X." Drop "will" unless you genuinely mean the future.

**Keep sentences short enough to read once.** If a sentence needs a second pass to parse, split it. Readability tracks with shorter sentences and shorter words — but vary the length (pattern in the core principles) so it doesn't read like a list.

---

## Not every flag is equal

Editorial linters rank issues by severity — error, warning, suggestion — and so should you. Some patterns are near-absolute: chatbot artifacts (19), curly quotes where straight ones belong (18), and knowledge-cutoff disclaimers (20) are almost always wrong. Others are judgment calls: a passive sentence, an intensifier, or an em dash can be the right choice in context. Use the patterns as defaults to question, not laws to enforce mechanically. The goal is prose that reads naturally, not a zero on a checker.

---

## Full Example

**Before (AI-sounding):**
> Great question! Here is an essay on this topic. I hope this helps!
>
> AI-assisted coding serves as an enduring testament to the transformative potential of large language models, marking a pivotal moment in the evolution of software development. In today's rapidly evolving technological landscape, these groundbreaking tools—nestled at the intersection of research and practice—are reshaping how engineers ideate, iterate, and deliver, underscoring their vital role in modern workflows.
>
> At its core, the value proposition is clear: streamlining processes, enhancing collaboration, and fostering alignment. It's not just about autocomplete; it's about unlocking creativity at scale, ensuring that organizations can remain agile while delivering seamless, intuitive, and powerful experiences to users. The tool serves as a catalyst. The assistant functions as a partner. The system stands as a foundation for innovation.
>
> Industry observers have noted that adoption has accelerated from hobbyist experiments to enterprise-wide rollouts, from solo developers to cross-functional teams. The technology has been featured in The New York Times, Wired, and The Verge. Additionally, the ability to generate documentation, tests, and refactors showcases how AI can contribute to better outcomes, highlighting the intricate interplay between automation and human judgment.
>
> - **Speed:** Code generation is significantly faster, reducing friction and empowering developers.
> - **Quality:** Output quality has been enhanced through improved training, contributing to higher standards.
> - **Adoption:** Usage continues to grow, reflecting broader industry trends.
>
> While specific details are limited based on available information, it could potentially be argued that these tools might have some positive effect. Despite challenges typical of emerging technologies—including hallucinations, bias, and accountability—the ecosystem continues to thrive. In order to fully realize this potential, teams must align with best practices.
>
> In conclusion, the future looks bright. Exciting times lie ahead as we continue this journey toward excellence. Let me know if you'd like me to expand on any section!

**Draft rewrite:**
> AI coding assistants speed up some tasks. In a 2024 study by Google, developers using Codex completed simple functions 55% faster than a control group, but showed no improvement on debugging or architectural decisions.
>
> The tools are good at boilerplate: config files, test scaffolding, repetitive refactors. They are bad at knowing when they are wrong. I have mass-accepted suggestions that compiled, passed lint, and still did the wrong thing because I stopped paying attention.
>
> Mira, an engineer at a fintech startup I interviewed, said she uses Copilot "like autocomplete for boring code" but reviews every line before committing. Jake, a senior dev at a larger company, disabled it after it kept suggesting patterns from a deprecated internal library.
>
> The productivity claims are hard to verify. GitHub says Copilot users "accept 30% of suggestions," but acceptance is not correctness, and correctness is not value. The 2024 Uplevel study found no statistically significant difference in pull-request throughput between teams with and without AI assistants.
>
> None of this means the tools are useless. It means they are tools. They do not replace judgment, and they do not eliminate the need for tests. If you do not have tests, you cannot tell whether the suggestion is right.

**What makes the below so obviously AI generated?**
- The rhythm is still a bit too tidy (clean contrasts, evenly paced paragraphs).
- The named people and study citations can read like plausible-but-made-up placeholders unless they're real and sourced.
- The closer leans a touch slogan-y ("If you do not have tests...") rather than sounding like a person talking.

**Now make it not obviously AI generated.**
> AI coding assistants can make you faster at the boring parts. Not everything. Definitely not architecture.
>
> They're great at boilerplate: config files, test scaffolding, repetitive refactors. They're also great at sounding right while being wrong. I've accepted suggestions that compiled, passed lint, and still missed the point because I stopped paying attention.
>
> People I talk to tend to land in two camps. Some use it like autocomplete for chores and review every line. Others disable it after it keeps suggesting patterns they don't want. Both feel reasonable.
>
> The productivity metrics are slippery. GitHub can say Copilot users "accept 30% of suggestions," but acceptance isn't correctness, and correctness isn't value. If you don't have tests, you're basically guessing.

**Changes made:**
- Removed chatbot artifacts ("Great question!", "I hope this helps!", "Let me know if...")
- Removed significance inflation ("testament", "pivotal moment", "evolving landscape", "vital role")
- Removed promotional language ("groundbreaking", "nestled", "seamless, intuitive, and powerful")
- Removed vague attributions ("Industry observers")
- Removed superficial -ing phrases ("underscoring", "highlighting", "reflecting", "contributing to")
- Removed negative parallelism ("It's not just X; it's Y")
- Removed rule-of-three patterns and synonym cycling ("catalyst/partner/foundation")
- Removed false ranges ("from X to Y, from A to B")
- Removed em dashes, emojis, boldface headers, and curly quotes
- Removed copula avoidance ("serves as", "functions as", "stands as") in favor of "is"/"are"
- Removed formulaic challenges section ("Despite challenges... continues to thrive")
- Removed knowledge-cutoff hedging ("While specific details are limited...")
- Removed excessive hedging ("could potentially be argued that... might have some")
- Removed filler phrases ("In order to", "At its core")
- Removed generic positive conclusion ("the future looks bright", "exciting times lie ahead")
- Made the voice more personal and less "assembled" (varied rhythm, fewer placeholders)
