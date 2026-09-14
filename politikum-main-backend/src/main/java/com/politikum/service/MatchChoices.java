package com.politikum.service;

import java.util.*;
import static com.politikum.engine.GameState.*;

/** UI choices derived only from the already redacted, viewer-specific state. */
public final class MatchChoices {
    private MatchChoices() { }
    private static String text(Object v) { return Objects.toString(v,""); }
    private static String base(Map<String,Object> c) { return text(c.get("id")).split("#",2)[0]; }
    private static boolean persona(Map<String,Object> c) { return "persona".equals(c.get("type")); }
    public static Map<String,Object> forView(Map<String,Object> state,String viewer) {
        Map<String,Object> g=map(state.get("G")),ctx=map(state.get("ctx")),pending=map(g.get("pending")),response=map(g.get("response"));
        Map<String,Object> targets=new LinkedHashMap<>(),hands=new LinkedHashMap<>();List<String> guesses=new ArrayList<>();
        Map<String,Object> reactions=new LinkedHashMap<>(),actions=new LinkedHashMap<>();
        var out=object("targets",targets,"hand",hands,"requiredDiscards",0,"guessIds",guesses,"reactions",reactions,"actions",actions);
        if(viewer==null||truthy(g.get("gameOver"))||truthy(ctx.get("gameover")))return out;
        List<Map<String,Object>> players=list(g.get("players"));Map<String,Object> me=players.stream().filter(p->viewer.equals(text(p.get("id")))).findFirst().orElse(Map.of());
        if(me.isEmpty())return out;
        String kind=text(pending.get("kind")),rk=text(response.get("kind"));boolean turn=viewer.equals(text(ctx.get("currentPlayer"))),owns=viewer.equals(text(pending.get("playerId"))),attacker=viewer.equals(text(pending.get("attackerId")));
        if(owns&&kind.equals("persona_16_discard3_from_hand"))out.put("requiredDiscards",Math.max(0,list(me.get("hand")).size()-6));
        Set<String> ownBases=new HashSet<>(); Set<String> ownIds=new HashSet<>();
        for(Map<String,Object> c:MatchChoices.<Map<String,Object>>cards(me,"coalition")) { ownBases.add(base(c)); ownIds.add(text(c.get("id"))); }
        Set<String> seen=new HashSet<>();for(var p:players)for(Map<String,Object> c:MatchChoices.<Map<String,Object>>cards(p,"coalition"))seen.add(base(c));
        for(Map<String,Object> c:MatchChoices.<Map<String,Object>>cards(g,"discard"))seen.add(base(c));
        for(Map<String,Object> c:MatchChoices.<Map<String,Object>>cards(me,"hand"))seen.add(base(c));
        if(owns&&kind.equals("persona_34_guess_topdeck"))for(int i=1;i<=45;i++)if(!seen.contains("persona_"+i))guesses.add("persona_"+i);
        for(var p:players)for(Map<String,Object> c:MatchChoices.<Map<String,Object>>cards(p,"coalition")) {
            String owner=text(p.get("id")),id=text(c.get("id"));boolean own=owner.equals(viewer),pers=persona(c),unshielded=!truthy(c.get("shielded"));List<?> tags=list(c.get("tags"));
            String move=switch(kind) {
                case "action_7_block_persona" -> attacker&&pers?"blockPersonaForAction7":null;
                case "action_13_shield_persona" -> attacker&&own&&pers?"shieldPersonaForAction13":null;
                case "action_17_choose_opponent_persona" -> attacker&&!own&&pers&&unshielded?"applyAction17ToPersona":null;
                case "persona_21_pick_target_invert" -> owns&&pers?"persona21InvertTokens":null;
                case "persona_26_pick_red_nationalist" -> owns&&ownBases.contains("persona_26")&&pers&&unshielded&&tags.contains("faction:red_nationalist")?"persona26PurgeRedNationalist":null;
                case "persona_28_pick_non_fbk" -> owns&&ownBases.contains("persona_28")&&pers&&unshielded&&!tags.contains("faction:fbk")?"persona28StealPlusTokens":null;
                case "persona_37_pick_opponent_persona" -> owns&&!own&&pers&&unshielded?"persona37BribeAndSilence":null;
                case "persona_5_pick_liberal" -> owns&&turn&&ownIds.contains(text(pending.get("sourceCardId")))&&!own&&pers&&unshielded&&tags.contains("faction:liberal")?"persona5PickLiberal":null;
                case "persona_11_pick_opponent_persona" -> owns&&turn&&ownBases.contains("persona_11")&&!own&&pers&&unshielded?"persona11DiscardOpponentPersona":null;
                case "persona_13_pick_target" -> owns&&owner.equals(text(pending.get("attackerId")))&&pers&&unshielded?"persona13PickTarget":null;
                case "discard_one_persona_from_any_coalition" -> owns&&turn&&pers&&unshielded?"discardPersonaFromCoalition":null;
                case "persona_7_swap_two_in_coalition" -> owns&&turn&&pers?"persona7SwapTwoInCoalition":null;
                case "persona_32_pick_bounce_target" -> owns&&own&&pers?"persona32BounceToHand":null;
                case "place_tokens_plus_vp" -> owns&&own?"applyPendingToken":null;
                case "persona_23_choose_self_inflict_draw" -> owns&&own&&base(c).equals("persona_23")?"persona23ChooseSelfInflict":null;
                case "persona_3_choice" -> owns&&turn&&pers&&unshielded&&!base(c).equals("persona_31")&&tags.contains("faction:leftwing")?"persona3ChooseOption":null;
                default -> null;
            };
            if(move!=null){@SuppressWarnings("unchecked") List<Object> values=(List<Object>)targets.computeIfAbsent(move,k->new ArrayList<>());values.add(object("ownerId",owner,"cardId",id));}
        }
        boolean targeted=Set.of("action_4_discard","action_9_discard_persona").contains(kind)&&viewer.equals(text(pending.get("targetId")));
        reactions.put("targetsMe",targeted);
        reactions.put("persona10Cancel",rk.equals("cancel_action")&&targeted&&viewer.equals(text(response.get("allowPersona10By")))
            &&MatchChoices.<Map<String,Object>>cards(me,"coalition").stream().anyMatch(c->persona(c)&&base(c).equals("persona_10")));
        Map<String,Object> swap=map(response.get("persona8Swap"));
        boolean canSwap=rk.equals("cancel_persona")&&viewer.equals(text(swap.get("playerId")))
            &&MatchChoices.<Map<String,Object>>cards(me,"coalition").stream().anyMatch(c->persona(c)&&base(c).equals("persona_8"))
            &&players.stream().filter(p->text(p.get("id")).equals(text(swap.get("ownerId"))))
                .anyMatch(p->MatchChoices.<Map<String,Object>>cards(p,"coalition").stream().anyMatch(c->persona(c)&&text(c.get("id")).equals(text(swap.get("playedPersonaId")))));
        reactions.put("persona8Swap",canSwap);
        if(canSwap)targets.put("persona8SwapWithPlayedPersona",List.of(object("ownerId",text(swap.get("ownerId")),"cardId",text(swap.get("playedPersonaId")))));
        actions.put("persona39RecycleSelf",turn&&"action".equals(ctx.get("phase"))&&pending.isEmpty()&&response.isEmpty()&&ownBases.contains("persona_39"));
        boolean unblocked=turn&&"action".equals(ctx.get("phase"))&&pending.isEmpty()&&response.isEmpty();
        actions.put("beginTurnDraw",unblocked&&!truthy(g.get("hasDrawn"))&&!list(g.get("deck")).isEmpty());
        actions.put("drawCard",unblocked&&truthy(g.get("hasDrawn"))&&!truthy(g.get("hasPlayed"))&&number(g.get("drawsThisTurn"))<2&&!list(g.get("deck")).isEmpty());
        actions.put("endTurn",unblocked&&truthy(g.get("hasDrawn"))&&truthy(g.get("hasPlayed")));
        String pendingOwner=truthy(pending.get("playerId"))?text(pending.get("playerId")):truthy(pending.get("attackerId"))?text(pending.get("attackerId")):text(pending.get("targetId"));
        actions.put("cancelPending",turn&&viewer.equals(pendingOwner)&&com.politikum.engine.JavaResponseRules.CANCELLABLE_PENDING.contains(kind));
        Map<String,Object> cardChoices=new LinkedHashMap<>();out.put("cards",cardChoices);
        Map<String,Object> playerChoices=new LinkedHashMap<>();out.put("players",playerChoices);
        if(owns&&turn&&kind.equals("persona_17_pick_opponent"))playerChoices.put("persona17PickOpponent",players.stream().filter(p->!viewer.equals(text(p.get("id")))).map(p->text(p.get("id"))).toList());
        if(owns&&kind.equals("persona_45_steal_from_opponent"))playerChoices.put("persona45StealFromOpponent",players.stream().filter(p->!viewer.equals(text(p.get("id")))&&!list(p.get("hand")).isEmpty()).map(p->text(p.get("id"))).toList());
        if(attacker&&kind.equals("action_18_pick_persona_from_discard"))cardChoices.put("pickPersonaFromDiscardForAction18",MatchChoices.<Map<String,Object>>cards(g,"discard").stream().filter(c->persona(c)&&!base(c).equals("persona_31")).map(c->text(c.get("id"))).toList());
        // Preserve the existing action-only UI for persona 20; changing its legacy rules is separate work.
        if(owns&&kind.equals("persona_20_pick_from_discard"))cardChoices.put("persona20PickFromDiscard",MatchChoices.<Map<String,Object>>cards(g,"discard").stream().filter(c->"action".equals(c.get("type"))).map(c->text(c.get("id"))).toList());
        if(owns&&turn&&kind.equals("persona_17_pick_persona_from_hand")) {
            var target=players.stream().filter(p->text(p.get("id")).equals(text(pending.get("targetId")))).findFirst().orElse(Map.of());
            cardChoices.put("persona17StealPersonaFromHand",MatchChoices.<Map<String,Object>>cards(target,"hand").stream().filter(MatchChoices::persona).map(c->text(c.get("id"))).toList());
        }
        boolean ready=turn&&"action".equals(ctx.get("phase"))&&pending.isEmpty()&&response.isEmpty()&&truthy(g.get("hasDrawn"));
        for(Map<String,Object> c:MatchChoices.<Map<String,Object>>cards(me,"hand")) {
            String id=text(c.get("id")),base=base(c);boolean action="action".equals(c.get("type"));
            boolean plays=number(g.get("playsThisTurn"))<(truthy(g.get("maxPlaysThisTurn"))?number(g.get("maxPlaysThisTurn")):1);
            boolean room=base.equals("persona_9")?players.stream().anyMatch(p->!viewer.equals(text(p.get("id")))&&list(p.get("coalition")).size()<7):list(me.get("coalition")).size()<7;
            boolean placementAvailable=MatchChoices.<Map<String,Object>>cards(me,"coalition").stream().anyMatch(coal->persona(coal)&&!base(coal).equals("persona_31"));
            var receivers=players.stream().filter(p->!viewer.equals(text(p.get("id")))&&(!base.equals("persona_9")||list(p.get("coalition")).size()<7)).map(p->text(p.get("id"))).toList();
            hands.put(id,object("targetPlayerIds",ready&&Set.of("persona_9","action_4","action_9").contains(base)?receivers:List.of(),"placementAvailable",placementAvailable,"choosePlacement",Set.of("persona_1","persona_12","persona_18","persona_19","persona_25","persona_42").contains(base)&&placementAvailable,
                "playPersona",ready&&persona(c)&&plays&&room,"playAction",ready&&!truthy(g.get("hasPlayed"))&&action&&!Set.of("action_6","action_8","action_14").contains(base),
                "cancelAction",rk.equals("cancel_action")&&action&&base.equals("action_6")&&!turn&&!viewer.equals(text(response.get("playedBy"))),
                "cancelPersona",rk.equals("cancel_persona")&&action&&base.equals("action_8")&&!viewer.equals(text(response.get("playedBy")))&&!base(map(response.get("personaCard"))).equals("persona_33"),
                "cancelEffectOnMe",rk.equals("cancel_action")&&targeted&&base.equals("action_14")&&!turn,
                "discardDownTo7",owns&&turn&&Set.of("discard_down_to_7","hand_limit_discard_before_draw").contains(kind),
                "discardEvent12b",kind.equals("event_12b_discard_from_hand")&&list(pending.get("targetIds")).contains(viewer),"discard16",owns&&kind.equals("persona_16_discard3_from_hand")));
        }
        for(var entry:hands.entrySet()) {
            Map<String,Object> flags=map(entry.getValue());
            if(truthy(flags.get("cancelAction")))reactions.putIfAbsent("cancelActionCardId",entry.getKey());
            if(truthy(flags.get("cancelPersona")))reactions.putIfAbsent("cancelPersonaCardId",entry.getKey());
            if(truthy(flags.get("cancelEffectOnMe")))reactions.putIfAbsent("cancelEffectCardId",entry.getKey());
        }
        return out;
    }
    private static <T> List<T> cards(Map<String,Object> object,String key) { return list(object.get(key)); }
}
