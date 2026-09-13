package com.politikum.engine;

import com.politikum.util.JsonUtils;
import java.time.Clock;
import java.util.*;
import java.util.function.DoubleSupplier;
import static com.politikum.engine.GameState.object;

/** Per-engine native rule wiring. All per-match state lives in the supplied nodes. */
final class NativeRuntime implements AbilityEffects,TurnEffects,JavaAbilityRules.Scoring,JavaAbilityRules.Titles {
    final JavaAbilityRules abilities;
    final JavaTurnRules turns;
    final JavaScoringRules scoring=new JavaScoringRules();
    final Clock clock;
    final DoubleSupplier random;
    private final Map<String,Map<String,Object>> catalog=new HashMap<>();
    private final Set<String> entryKeys=new HashSet<>();
    private static final Map<String,String> ACTIONS=Map.of("action_4","Умри ты сегодня а я завтра","action_5","Культура политики в восточной европе","action_9","Вывод во внешний контур","action_14","Волонтёрство","action_8","Работа на Кремль","action_17","Ася Несоевая");
    private static final Map<String,String> EVENTS=Map.ofEntries(Map.entry("event_1","Экокредиты"),Map.entry("event_2","Сладкий Подарок"),Map.entry("event_3","Грант Госдепа"),Map.entry("event_10","Перевод в Криптоколонию"),Map.entry("event_11","Тайный Удвоитель"),Map.entry("event_12a","Набег единорогов"),Map.entry("event_12b","Срач в твиттере: Секс скандал"),Map.entry("event_12c","Срач в твиттере - русский флаг"),Map.entry("event_16","Политический [РОСКОМНАДЗОР]"));
    private static final Set<String> EMPTY=Set.of("persona_35_no_ability","persona_22_global_enter_mods","persona_24_passive_dual_leftwing_scaler","persona_38_global_event_token_vacuum","persona_36_passive_ignore_action7","persona_13_retaliate_on_targeted_action");
    NativeRuntime(CardCatalog cards,Clock clock,DoubleSupplier random) {
        this.clock=clock;this.random=random;
        for(Object item:JsonUtils.mapper().convertValue(JsonUtils.parseMap("{\"cards\":"+cards.json()+"}").get("cards"),List.class)) {
            Map<String,Object> c=GameState.map(item);catalog.put(String.valueOf(c.get("id")),c);
        }
        // Native entry operations, including extension keys absent from today's catalog.
        entryKeys.addAll(List.of("draw_1","place_tokens_plus_vp","on_enter_adjacent_bonus","persona_4_on_enter_twitter_penalty","persona_12_on_enter_adjacent_red_buff","persona_3_on_enter_choice","persona_5_discard_liberal_steal_tokens","persona_7_swap_two_in_coalition","persona_45_steal_from_opponent","persona_21_on_enter_invert_tokens","persona_23_on_enter_self_inflict_draw","persona_26_on_enter_purge_red_inherit_plus","persona_28_on_enter_steal_plus_tokens","persona_32_activate_bounce","persona_41_on_enter_buff_fbk","persona_37_on_enter_bribe_and_silence","persona_16_on_enter_draw3_discard3","persona_33_on_enter_choose_faction","persona_34_on_enter_guess_topdeck","persona_43_on_enter_drain_rightwing","persona_6_on_action8_plus1","persona_30_on_enter_buff_liberals","persona_17_on_enter_steal_persona","persona_20_on_enter_take_from_discard","event_draw_cards","event_faction_minus1_draw1","event_12b_discard_others_hand","event_shuffle_all_hands_redeal","event_16_discard_self_persona_then_draw1","discard_one_persona_from_any_coalition"));
        abilities=new JavaAbilityRules(this,this,this);turns=new JavaTurnRules(clock,this);
    }
    static RuleNode nil() { return new MapRuleNode(null); }
    static Map<String,Object> map(RuleNode n) { return GameState.map(((MapRuleNode)n).value()); }
    static String base(RuleNode c) { return c.get("id").text().split("#",2)[0]; }
    static String name(RuleNode c) { return c.get("name").truthy()?c.get("name").text():c.get("id").text(); }
    static String who(RuleNode p) { return p.get("name").text().equals("You")?"Вы":p.get("name").text(); }
    static int find(RuleNode a,String id) { for(int i=0;i<a.size();i++)if(a.at(i).get("id").text().equals(id))return i;return -1; }
    static RuleNode player(RuleNode g,String id) { return g.get("players").at(find(g.get("players"),id)); }
    static boolean personaCard(RuleNode c) { return c.get("type").text().equals("persona"); }
    static boolean bot(RuleNode p) { return p.get("isBot").truthy()||p.get("name").text().startsWith("[B]"); }
    static boolean eligible(RuleNode c) { return personaCard(c)&&!base(c).equals("persona_31")&&!c.get("shielded").truthy(); }
    static void log(RuleNode g,String message) { g.get("log").add(message); }
    boolean ability(String op,RuleNode g,RuleNode me,RuleNode card,RuleNode ctx,String actor,String target) { return abilities.invoke(op,g,me,card,ctx,actor,target); }
    Object turn(String op,RuleNode g,RuleNode ctx,String actor) { return turns.invoke(op,MapRuleNode.of(object("G",g,"ctx",ctx,"__eventQueue",List.of())),actor,nil()); }
    public void run(RuleNode g,RuleNode me,RuleNode c) { runKey(c.get("abilityKey").text(),g,me,c); }
    void runKey(String key,RuleNode g,RuleNode me,RuleNode c) {
        if(key.isEmpty())return;
        if(c.get("blockedAbilities").truthy()) { log(g,who(me)+": способность заблокирована ("+key+", "+c.get("id").text()+").");return; }
        if(EMPTY.contains(key))return;
        if(entryKeys.contains(key)) { ability(key,g,me,c,nil(),"","");return; }
        if(key.equals("steal_1_random_from_opponent")) {
            RuleNode target=nil(),players=g.get("players");int most=0;
            for(int i=0;i<players.size();i++)if(!players.at(i).get("id").text().equals(me.get("id").text())&&players.at(i).get("hand").size()>most){target=players.at(i);most=target.get("hand").size();}
            if(most>0){me.get("hand").add(target.get("hand").removeAt((int)Math.floor(random()*most)));log(g,who(me)+" украл 1 карту у "+target.get("name").text()+".");}return;
        }
        log(g,who(me)+(key.equals("adj_vp_plus1_if_neighbor_tag")?": способность TODO (соседство): "+c.get("id").text():": способность TODO ("+key+", "+c.get("id").text()+")"));
    }
    public void eventPlayed(RuleNode g,RuleNode c) { ability("vacuum38",g,nil(),c,nil(),"",""); }
    public void expire(RuleNode g) { turn("expire",g,nil(),""); }
    public boolean endRound(RuleNode g,RuleNode ctx) { return Boolean.TRUE.equals(turn("maybeEndAfterRound",g,ctx,"")); }
    public void triggerRoundEnd(RuleNode g,RuleNode ctx) { turn("triggerRoundEnd",g,ctx,""); }
    public double random() { return random.getAsDouble(); }
    public long now() { return clock.millis(); }
    public double score(RuleNode p) { return scoring.scorePlayer(map(p)); }
    public boolean responseExpired(RuleNode g) { return turns.responseExpired(g); }
    public void adjacent(RuleNode g,RuleNode me,RuleNode c) { ability("around",g,me,c,nil(),"",""); }
    public String action(RuleNode c) { String raw=rawTitle(c),mapped=ACTIONS.getOrDefault(base(c),"");return !mapped.isEmpty()&&(raw.isEmpty()||raw.matches("action_\\d+.*")||raw.equals(base(c)))?mapped:!raw.isEmpty()?raw:!mapped.isEmpty()?mapped:c.get("id").text(); }
    public String actionTitle(RuleNode c) { return ACTIONS.getOrDefault(base(c),action(c)); }
    public String persona(String id) { return Objects.toString(catalog.getOrDefault(id,Map.of()).get("text"),id); }
    private static String rawTitle(RuleNode c) { return (c.get("text").truthy()?c.get("text").text():c.get("name").text()).trim(); }
    public String eventTitle(RuleNode c) { return c.get("text").truthy()?c.get("text").text():c.get("name").truthy()?c.get("name").text():!base(c).equals("event_11")&&EVENTS.containsKey(base(c))?(base(c).equals("event_1")?"ЭКОКРЕДИТЫ":EVENTS.get(base(c))):c.get("id").text(); }
    public String eventBaseTitle(String id) { return EVENTS.getOrDefault(id,""); }
    public String eventMoveTitle(RuleNode c) { String raw=rawTitle(c);return raw.isEmpty()||raw.matches("event_\\d+.*")||raw.equals(base(c))?EVENTS.getOrDefault(base(c),raw.isEmpty()?c.get("id").text():raw):raw; }
    public String cardTitle(String id) { String bid=id.split("#",2)[0];return bid.matches("event_\\d+.*")?EVENTS.getOrDefault(bid,bid):bid.matches("action_\\d+.*")?ACTIONS.getOrDefault(bid,bid):bid.matches("persona_\\d+.*")?persona(bid):bid; }
    public String actor(RuleNode p,String id) { RuleNode cards=p.get("coalition"),self=nil();for(int i=0;i<cards.size();i++)if(base(cards.at(i)).equals(id)){self=cards.at(i);break;}return who(p)+" "+(self.get("name").truthy()?self.get("name").text():self.get("text").truthy()?self.get("text").text():id); }
    public void simple(RuleNode c,double delta) { scoring.applySimpleTokens(map(c),delta); }
    public void tokens(RuleNode g,RuleNode c,double delta) { scoring.applyTokens(map(g),map(c),delta,false); }
    public void recalculate(RuleNode g) { scoring.recalculate(map(g)); }
    public void personaDiscarded(RuleNode g) { scoring.personaDiscarded(map(g)); }
    public void drawnEvent(RuleNode g,RuleNode p,RuleNode c) { ability("turnDrawnEvent",g,p,c,nil(),"",""); }
    public void queuedEvent(RuleNode g,RuleNode queue,RuleNode c) { ability("turnQueuedEvent",g,queue,c,nil(),"",""); }
    public void deferredPersona(RuleNode g,RuleNode pending) {
        String id=pending.get("personaId").text();RuleNode players=g.get("players");
        for(int i=0;i<players.size();i++){RuleNode p=players.at(i),c=p.get("coalition").at(find(p.get("coalition"),id));if(!c.missing()){runKey(pending.get("abilityKey").truthy()?pending.get("abilityKey").text():c.get("abilityKey").text(),g,p,c);adjacent(g,p,c);return;}}
    }
}
