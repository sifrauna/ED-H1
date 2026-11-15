"""Run:  python tests_agents.py      (uses a fake LLM, needs no Ollama and no internet)"""
import asyncio, os, re, tempfile
from datetime import datetime
import agents_core as core

DB = os.path.join(tempfile.mkdtemp(), "t.db")
core.init_db(DB)
passed = 0

def check(name, cond):
    global passed
    print(("PASS " if cond else "FAIL ") + name)
    if not cond:
        raise SystemExit(1)
    passed += 1

calls = []
def make_llm(script=None):
    async def llm(messages, max_tokens=300):
        calls.append(messages)
        who = re.match(r"You are (\w+)", messages[0]["content"])
        who = who.group(1) if who else "Sys"
        if script:
            return script(who, messages)
        topics = ["pick a quiet cafe near the river", "bring a deck of cards for later", "start with a short hike",
                  "cook pasta together in the evening", "visit the old bookshop downtown", "watch the sunset from the hill",
                  "try the new board game store", "leave early to avoid traffic", "sketch the skyline for fun",
                  "invite a few friends along", "keep the budget small and simple", "end the day with music"]
        return f"{who}: I suggest we {topics[len(calls) % len(topics)]}."
    return llm

async def main():
    otto = core.create_character(DB, {"name": "Otto", "personality": "Analytical and logical.", "voice": {"rate": 0.9}})
    milo = core.create_character(DB, {"name": "Milo", "personality": "Playful and sarcastic.", "can_initiate": True})
    check("two characters created", len(core.list_characters(DB)) == 2 and otto["voice"]["rate"] == 0.9)
    try:
        core.create_character(DB, {"name": "otto", "personality": "x"}); dup = False
    except core.AgentError:
        dup = True
    check("duplicate name rejected", dup)

    m1 = core.build_chat_messages(DB, otto["id"], "hi")[0]["content"]
    m2 = core.build_chat_messages(DB, milo["id"], "hi")[0]["content"]
    check("different personalities in context", "Analytical" in m1 and "Playful" in m2 and "Playful" not in m1)

    llm = make_llm()
    reply, rem = await core.character_chat(DB, otto["id"], "Remember that I study physics. I love chess.", llm)
    check("chat reply + auto memories", reply.startswith("Otto") and len(rem) == 2)
    _, rem2 = await core.character_chat(DB, otto["id"], "Remember that I study physics.", llm)
    check("duplicate memory not stored twice", rem2 == [])
    check("memories are per character",
          len(core.rows(DB, "SELECT * FROM character_memories WHERE character_id=?", (milo["id"],))) == 0)
    sys_prompt = core.build_chat_messages(DB, otto["id"], "tell me about physics")[0]["content"]
    check("relevant memory retrieved into context", "physics" in sys_prompt)
    check("other character does not see it",
          "physics" not in core.build_chat_messages(DB, milo["id"], "tell me about physics")[0]["content"])

    g = core.create_group(DB, "Study group", [otto["id"], milo["id"]])
    res = await core.run_group_turns(DB, g["id"], llm, max_turns=4, user_message="Plan our weekend")
    speakers = [m["speaker_name"] for m in res["messages"] if m["speaker_kind"] == "character"]
    check("group run stops at turn cap", len(speakers) == 4 and res["stopped"] == "turn limit reached")
    check("speakers alternate", all(a != b for a, b in zip(speakers, speakers[1:])))
    res = await core.run_group_turns(DB, g["id"], llm, max_turns=99)
    check("hard cap enforced", len([m for m in res["messages"]]) <= core.HARD_MAX_TURNS)

    res = await core.run_group_turns(DB, g["id"], make_llm(lambda w, m: "PASS"), max_turns=6)
    check("PASS ends conversation early", res["messages"] == [] and "pause" in res["stopped"])
    res = await core.run_group_turns(DB, g["id"], make_llm(lambda w, m: "Exactly the same line again and again"), max_turns=6)
    check("repeated lines stop the loop", len(res["messages"]) <= 1)
    ev = asyncio.Event(); ev.set()
    res = await core.run_group_turns(DB, g["id"], llm, max_turns=5, cancel=ev)
    check("cancel stops immediately", res["messages"] == [] and res["stopped"] == "cancelled by user")
    res = await core.run_group_turns(DB, g["id"], make_llm(lambda w, m: "Hi there friend\nMilo: pretending to be Milo\nOtto: pretending to be Otto"), max_turns=1)
    check("speaker cannot write other speakers' lines",
          res["messages"] != [] and all(
              not re.search(rf"^{n}:", m["content"], re.M)
              for m in res["messages"] for n in ("Otto", "Milo") if n != m["speaker_name"]))

    rel = core.get_relationship(DB, otto["id"], milo["id"])
    check("familiarity grew from real exchanges", rel["familiarity"] > 0 and rel["interactions"] > 0)

    def reflect(who, msgs):
        return ('Sure! {"relationships":[{"from":"Otto","to":"Milo","trust":5,"rapport":0.08,"rivalry":-1,'
                '"event":"planned a weekend together"}],"shared_memory":"Otto and Milo planned a weekend."}')
    out = await core.reflect_on_group(DB, g["id"], make_llm(reflect))
    rel = core.get_relationship(DB, otto["id"], milo["id"])
    check("relationship update parsed and clamped", out["relationships"] == 1 and rel["trust"] == 0.1 and rel["rivalry"] == 0)
    check("shared event remembered", "planned a weekend together" in rel["history"])
    check("shared memory stored once",
          core.add_shared_memory(DB, [otto["id"], milo["id"]], "Otto and Milo planned a weekend.")["duplicate"])
    out = await core.reflect_on_group(DB, g["id"], make_llm(lambda w, m: "not json at all"))
    check("bad JSON from model is ignored safely", out["relationships"] == 0)
    sysmsg = []
    await core.run_group_turns(DB, g["id"], make_llm(lambda w, m: sysmsg.append(m[0]["content"]) or "ok " + w), max_turns=1)
    check("relationship appears in prompt", "planned a weekend together" in sysmsg[0])

    core.init_db(DB)   # simulates an app restart
    check("relationships persist after restart", core.get_relationship(DB, otto["id"], milo["id"])["trust"] == 0.1)

    for i in range(45):
        core.run(DB, "INSERT INTO character_messages(character_id, role, content) VALUES(?,?,?)",
                 (milo["id"], "user" if i % 2 == 0 else "assistant", f"message {i} about cats"))
    added = await core.compact_history(DB, milo["id"], make_llm(lambda w, m: "- The user likes cats\n- Planned nothing"))
    left = core.row(DB, "SELECT COUNT(*) n FROM character_messages WHERE character_id=?", (milo["id"],))["n"]
    check("history compacted into memories", added == 2 and left == 20)

    st = core.get_settings(DB)
    check("autonomy off by default", st["autonomy_enabled"] is False)
    check("autonomy blocked when off", core.autonomy_candidate(DB)["allowed"] is False)
    core.set_settings(DB, {"autonomy_enabled": True, "quiet_hours": "22:00-07:00"})
    noon, night = datetime(2026, 11, 11, 12, 0), datetime(2026, 11, 11, 23, 30)
    check("quiet hours respected", core.autonomy_candidate(DB, night)["reason"] == "quiet hours")
    cand = core.autonomy_candidate(DB, noon)
    check("only characters with permission may start", cand["allowed"] and cand["character"]["name"] == "Milo")
    core.log_autonomy(DB, milo["id"], "Fancy a game?")
    check("cooldown after an initiative", core.autonomy_candidate(DB, noon)["reason"] == "cooling down")
    for bad in ({"max_turns_per_run": 99}, {"quiet_hours": "late"}, {"nope": 1}):
        try:
            core.set_settings(DB, bad); ok = False
        except core.AgentError:
            ok = True
        check(f"invalid setting rejected {list(bad)[0]}", ok)

    r = None
    for _ in range(3):
        r = core.record_result(DB, "tictactoe", "easy", True, 10)
    check("level rises after 3 wins", r["level"] == 2 and r["level_change"] == 1)
    for _ in range(3):
        r = core.record_result(DB, "tictactoe", "easy", False)
    check("level falls after 3 losses", r["level"] == 1)
    rw = core.get_rewards(DB)
    check("points and first-win badge", rw["points"] > 0 and any(b["name"] == "First Win" for b in rw["badges"]))

    core.delete_character(DB, milo["id"])
    check("delete cascades (memories, relationships, membership)",
          core.row(DB, "SELECT COUNT(*) n FROM character_memories WHERE character_id=?", (milo["id"],))["n"] == 0
          and core.row(DB, "SELECT COUNT(*) n FROM relationships WHERE from_id=? OR to_id=?", (milo["id"], milo["id"]))["n"] == 0
          and len(core.get_group(DB, g["id"])["members"]) == 1)

asyncio.run(main())
print(f"\nAll {passed} checks passed")
