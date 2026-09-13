package com.politikum.engine;

import com.politikum.util.JsonUtils;
import java.time.Clock;
import java.util.*;
import java.util.function.DoubleSupplier;
import static com.politikum.engine.GameState.object;
import static com.politikum.engine.NativeRuntime.*;

/** Authoritative Java-only match executor; failures leave the supplied state unchanged. */
public final class JavaGameEngine implements GameEngine {
    private final JavaLobbyEngine lobby;
    private final NativeRuntime r;
    private final JavaBotRules bots;
    private static final Set<String> TURN=Set.of("beginTurnDraw","drawCard","endTurn","tick","skipResponseWindow","forceSkipTurn","discardFromHandDownTo7");
    private static final Map<String,String> SIMPLE=Map.ofEntries(
        Map.entry("applyPendingToken","applyPendingToken"),Map.entry("discardPersonaFromCoalition","discardPersonaFromCoalition"),
        Map.entry("persona3Skip","skip3"),Map.entry("persona3ChooseOption","choose3"),Map.entry("persona12ChooseAdjacentRed","chooseRed"),
        Map.entry("persona5PickLiberal","pickLiberal"),Map.entry("discardFromHandForEvent12b","eventDiscardHand"),Map.entry("discardPersonaFromOwnCoalitionForEvent16","eventDiscardCoalition"),
        Map.entry("persona7SwapTwoInCoalition","swapCoalition"),Map.entry("persona8SwapWithPlayedPersona","swapResponse"),Map.entry("persona10CancelFromHand","cancel10"),Map.entry("persona10CancelFromCoalition","cancel10"),
        Map.entry("persona11Skip","skipSolovei"),Map.entry("persona11Use","useSolovei"),Map.entry("persona11DiscardOpponentPersona","discardSolovei"),
        Map.entry("persona17PickOpponent","pick17"),Map.entry("persona17StealPersonaFromHand","steal17"),Map.entry("persona32BounceToHand","bounceToHand"),Map.entry("cancelPending","cancelPending"),Map.entry("persona32CancelBounce","cancelBounce"),
        Map.entry("persona33ChooseFaction","chooseFaction"),Map.entry("persona34GuessTopdeck","guessTopdeck"),Map.entry("persona39ActivateRecycle","recycle39"),Map.entry("persona45StealFromOpponent","steal45"),
        Map.entry("shieldPersonaForAction13","action13"),Map.entry("applyAction17ToPersona","action17"),Map.entry("pickPersonaFromDiscardForAction18","action18"),Map.entry("persona16Discard3FromHand","discard16"),Map.entry("persona20PickFromDiscard","recoverDiscard"),Map.entry("playAction","playAction"),Map.entry("discardFromCoalition","actionDiscard"),Map.entry("persona13Skip","skipRetaliation"));
    private static final Map<String,String> OWNER=Map.of("persona21InvertTokens","invertTokens","persona26PurgeRedNationalist","purgeRed","persona28StealPlusTokens","stealPlus","persona37BribeAndSilence","bribeAndSilence","persona13PickTarget","retaliate");
    public JavaGameEngine(CardCatalog catalog,Clock clock,DoubleSupplier random) { lobby=new JavaLobbyEngine(catalog,clock,random);r=new NativeRuntime(catalog,clock,random);bots=new JavaBotRules(r); }
    public Map<String,Object> createMatchState(int n) { return lobby.createMatchState(n); }
    public Map<String,Object> applyMove(Map<String,Object> input,String actor,String move,List<Object> args) {
        if(lobby.supports(move))return lobby.applyMove(input,actor,move,args);
        GameState copy=new GameState(input);
        if(copy.finished())return object("ok",false,"error","gameover","state",input);
        if(!TURN.contains(move)&&!SIMPLE.containsKey(move)&&!OWNER.containsKey(move)&&!Set.of("playPersona","tickBot","blockPersonaForAction7","persona23ChooseSelfInflict","discardBeforeDrawForHandLimit").contains(move))return object("ok",false,"error","unknown_move","state",input);
        RuleNode state=new MapRuleNode(copy.value()),g=state.get("G"),ctx=state.get("ctx"),a=MapRuleNode.of(args==null?List.of():args);
        state.set("__eventQueue",List.of());RuleNode queue=state.get("__eventQueue");
        String pending=g.get("pending").get("kind").text(),response=g.get("response").get("kind").text();
        try {
            boolean ok;
            if(TURN.contains(move))ok=Boolean.TRUE.equals(r.turns.invoke(move,state,actor,a));
            else if(move.equals("playPersona"))ok=playPersona(g,ctx,queue,actor,a);
            else if(move.equals("tickBot"))ok=bots.tick(g,ctx,queue);
            else if(move.equals("discardBeforeDrawForHandLimit"))ok=discardBeforeDraw(g,ctx,actor,a.at(0).text());
            else if(move.equals("persona23ChooseSelfInflict"))ok=r.ability("choose23",g,nil(),a,MapRuleNode.of(object("amount",a.at(0).number())),actor,"");
            else if(move.equals("blockPersonaForAction7"))ok=r.ability("action7",g,queue,MapRuleNode.of(List.of(a.at(0).text())),ctx,actor,a.at(1).text());
            else if(OWNER.containsKey(move))ok=r.ability(OWNER.get(move),g,nil(),nil(),MapRuleNode.of(object("ownerId",a.at(0).text(),"amount",a.at(2).missing()?3:a.at(2).number())),actor,a.at(1).text());
            else {
                String op=SIMPLE.get(move);
                ok=r.ability(op,g,queue,a,ctx,actor,a.at(0).text());
                if(ok&&Set.of("skip3","choose3","pickLiberal").contains(op)){r.triggerRoundEnd(g,ctx);end(g,ctx,queue);}
            }
            if(!ok)return object("ok",false,"error","invalid_move","state",input);
            String argText=JsonUtils.stringify(args==null?List.of():args);if(argText.length()>180)argText=argText.substring(0,180)+"…";
            if(!g.get("trace").array())g.set("trace",List.of());RuleNode trace=g.get("trace");
            trace.add(object("ts",r.now(),"turn",ctx.get("turn").number(),"phase",ctx.get("phase").text(),"currentPlayer",ctx.get("currentPlayer").text(),"playerID",actor,"move",move,"args",argText,"result","ok","pending",pending,"response",response));
            while(trace.size()>300)trace.removeAt(0);
            r.turns.invoke("flush",state,actor,nil());state.remove("__eventQueue");copy.advanceVersion();
            return object("ok",true,"state",copy.value());
        } catch(RuntimeException e) { return object("ok",false,"error","move_exception","message",Objects.toString(e.getMessage(),e.toString()),"state",input); }
    }
    private void end(RuleNode g,RuleNode ctx,RuleNode queue) { if(!r.endRound(g,ctx))queue.add(object("type","endTurn","payload",null)); }
    static String accusative(String name) { return name.endsWith("ин")||name.endsWith("ов")||name.endsWith("ев")?name+"а":name.endsWith("ский")?name.substring(0,name.length()-4)+"ского":name; }
    private boolean playPersona(RuleNode g,RuleNode ctx,RuleNode queue,String actor,RuleNode args) {
        r.expire(g);
        if(!actor.equals(ctx.get("currentPlayer").text())||g.get("pending").truthy()||g.get("response").truthy()&&!r.responseExpired(g)||!g.get("hasDrawn").truthy())return false;
        double plays=g.get("playsThisTurn").number(),max=g.get("maxPlaysThisTurn").truthy()?g.get("maxPlaysThisTurn").number():1;
        RuleNode p=player(g,actor),hand=p.get("hand");int idx=find(hand,args.at(0).text());if(plays>=max||p.missing()||idx<0)return false;
        RuleNode c=hand.at(idx);if(!personaCard(c))return false;RuleNode owner=p;
        if(base(c).equals("persona_9")){owner=player(g,args.at(3).text());if(owner.missing()||owner.get("id").text().equals(actor))return false;}
        RuleNode cards=owner.get("coalition");if(cards.size()>=7)return false;hand.removeAt(idx);
        double delta=g.get("playVpDelta").number();if(delta!=0&&!c.get("_turnPlayVpDeltaApplied").truthy()){c.set("_turnPlayVpDeltaApplied",true);r.tokens(g,c,delta);}
        if(base(c).equals("persona_15"))c.set("_p15ArmedTurn",(g.get("turnN").truthy()?g.get("turnN").number():ctx.get("turn").number())+1);
        int j=args.at(1).truthy()?find(cards,args.at(1).text()):-1;
        if(j<0)cards.add(c);else { int at=args.at(2).text().equals("left")?j:j+1;cards.add(c);for(int k=cards.size()-1;k>at;k--)cards.set(String.valueOf(k),cards.at(k-1));cards.set(String.valueOf(at),c); }
        r.ability("globalEnter22",g,nil(),c,ctx,actor,"");r.recalculate(g);g.set("playsThisTurn",plays+1);g.set("hasPlayed",plays+1>=max);
        String title=c.get("name").truthy()?c.get("name").text():c.get("text").truthy()?c.get("text").text():c.get("id").text();
        log(g,(bot(p)?p.get("name").text():who(p))+" добавил "+accusative(title)+" в коалицию"+(owner==p?"":" "+owner.get("name").text()));
        r.ability("playedPersonaResponse",g,owner,c,ctx,actor,"");r.triggerRoundEnd(g,ctx);
        if(!r.endRound(g,ctx)&&g.get("hasPlayed").truthy()&&!g.get("pending").truthy())queue.add(object("type","endTurn","payload",null));return true;
    }
    private boolean discardBeforeDraw(RuleNode g,RuleNode ctx,String actor,String id) {
        RuleNode pending=g.get("pending"),p=player(g,actor),hand=p.get("hand");int idx=find(hand,id);
        if(!pending.truthy()||!pending.get("playerId").text().equals(actor)||!ctx.get("currentPlayer").text().equals(actor)||p.missing()||idx<0)return false;
        RuleNode c=hand.removeAt(idx);g.get("discard").add(c);if(personaCard(c))r.personaDiscarded(g);
        if(pending.get("kind").text().equals("discard_down_to_7")){log(g,who(p)+" сбросил "+name(c)+", чтобы в руке осталось не больше 7.");if(hand.size()<=7)g.set("pending",null);r.recalculate(g);return true;}
        if(!pending.get("kind").text().equals("hand_limit_discard_before_draw"))return false;
        pending.set("remaining",pending.get("remaining").number()-1);log(g,who(p)+" сбросил "+name(c)+" перед добором.");
        if(pending.get("remaining").number()<=0){g.set("pending",null);bots.draw(g,p);g.set("hasDrawn",true);}r.recalculate(g);return true;
    }
}
