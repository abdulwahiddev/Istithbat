# Real-source test fixtures

These files are **unmodified** HTTP response bodies captured on 4 Oct 2026 from the official public APIs, used only as offline test inputs for the read-only connectors. They are **not** synthetic and are **never** mutated by Istithbat.

| Files | Publisher / source | Official endpoint | Terms |
|---|---|---|---|
| `hadeethenc-*.json` | HadeethEnc.com — Encyclopedia of Translated Prophetic Hadiths | `https://hadeethenc.com/api/v1/hadeeths/one/?language={ar,en}&id={id}` | No modification, addition or deletion of the content; clearly refer to the publisher and the source (HadeethEnc.com). |
| `quranenc-*.json` | QuranEnc.com — The Noble Qur'an Encyclopedia (translation `english_saheeh`, Noor International Center) | `https://quranenc.com/api/v1/translations/list/en`, `https://quranenc.com/api/v1/translation/sura/english_saheeh/{1,112}` | May be downloaded and re-published with no modification, addition or deletion, and with clear reference to the publisher and the source (QuranEnc.com). |

Any change to these bytes inside a test is done in memory and only to exercise the diff engine. It is never stored, published, or attributed to the provider.
