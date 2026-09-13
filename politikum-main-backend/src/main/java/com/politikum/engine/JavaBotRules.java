package com.politikum.engine;

import java.util.*;
import java.util.function.Predicate;
import static com.politikum.engine.GameState.object;
import static com.politikum.engine.NativeRuntime.*;

/** Bot scheduling and remaining automatic choices, preserving established timing. */
final class JavaBotRules {
    private final NativeRuntime r;
    JavaBotRules(NativeRuntime runtime) { r=runtime; }
    private boolean call(String op,RuleNode g,RuleNode p,RuleNode queue,RuleNode ctx) { return r.ability(op,g,p,queue,ctx,p.get("id").text(),""); }
    private void delay(RuleNode g,long ms) { g.set("botNextActAtMs",r.now()+ms); }
    private void end(RuleNode g,RuleNode ctx,RuleNode queue) { if(!r.endRound(g,ctx))queue.add(object("type","endTurn","payload",null)); }
    private static boolean owns(RuleNode pending,RuleNode p,String kind) { return pending.get("kind").text().equals(kind)&&pending.get("playerId").text().equals(p.get("id").text()); }
    private static RuleNode first(RuleNode cards,Predicate<RuleNode> pred) { for(int i=0;i<cards.size();i++)if(pred.test(cards.at(i)))return cards.at(i);return nil(); }
    private static RuleNode firstGlobal(RuleNode g,Predicate<RuleNode> pred) { RuleNode players=g.get("players");for(int i=0;i<players.size();i++){RuleNode c=first(players.at(i).get("coalition"),pred);if(!c.missing())return c;}return nil(); }
    private static boolean tagged(RuleNode c,String tag) { RuleNode tags=c.get("tags");for(int i=0;i<tags.size();i++)if(tags.at(i).text().equals(tag))return true;return false; }
    private static String num(double n) { return String.valueOf(JavaScoringRules.numeric(n)); }
    private void clear(RuleNode g,long ms) { g.set("pending",null);r.recalculate(g);delay(g,ms); }
    void draw(RuleNode g,RuleNode p) {
        if(g.get("deck").size()==0)return;RuleNode c=g.get("deck").removeAt(0);if(!c.truthy())return;
        if(c.get("type").text().equals("event"))r.ability("legacyDrawnEvent",g,p,c,nil(),"","");
        else { p.get("hand").add(c);log(g,p.get("name").text()+" берет карту"); }
    }
    boolean tick(RuleNode g,RuleNode ctx,RuleNode queue) {
        try {
            if(!ctx.get("phase").text().equals("action"))return false;r.expire(g);
            RuleNode response=g.get("response");
            if(response.truthy()&&g.get("botPauseUntilMs").number()>response.get("expiresAtMs").number())g.set("botPauseUntilMs",response.get("expiresAtMs").number());
            if(response.truthy()) {
                boolean humans=false;RuleNode players=g.get("players");
                for(int i=0;i<players.size();i++){RuleNode p=players.at(i);if(p.get("active").truthy()&&!p.get("id").text().equals(response.get("playedBy").text())&&!bot(p))humans=true;}
                if(r.responseExpired(g)||!humans){g.set("response",null);g.set("botPauseUntilMs",0);if(!humans&&g.get("pending").get("kind").text().equals("resolve_persona_after_response"))r.expire(g);}
            }
            RuleNode p=player(g,ctx.get("currentPlayer").text());if(p.missing()||!bot(p))return false;
            double started=g.get("turnStartedAtMs").number();
            if(started!=0&&r.now()-started>20000){g.set("pending",null);g.set("response",null);g.set("botPauseUntilMs",0);g.set("hasDrawn",true);g.set("hasPlayed",true);log(g,who(p)+" turn auto-skipped (20s hard cap).");end(g,ctx,queue);return true;}
            if(g.get("botPauseUntilMs").truthy()&&r.now()<g.get("botPauseUntilMs").number()||g.get("botNextActAtMs").truthy()&&r.now()<g.get("botNextActAtMs").number())return true;
            if(g.get("response").truthy()&&!r.responseExpired(g)){delay(g,250);return true;}
            if(call("botEarlyChoice",g,p,queue,ctx))return true;
            RuleNode pending=g.get("pending");
            if(owns(pending,p,"hand_limit_discard_before_draw")) {
                double count=Math.max(0,pending.get("remaining").number());RuleNode hand=p.get("hand");
                for(int i=0;i<count&&hand.size()>0;i++){RuleNode c=hand.removeAt(0);if(c.truthy()){g.get("discard").add(c);if(personaCard(c))r.personaDiscarded(g);}}
                log(g,who(p)+" сбрасывает "+num(count)+" карт перед добором, чтобы после взятия в руке было не больше 7.");
                g.set("pending",null);draw(g,p);g.set("hasDrawn",true);r.recalculate(g);delay(g,600);return true;
            }
            if(owns(pending,p,"place_tokens_plus_vp")) {
                RuleNode target=first(p.get("coalition"),NativeRuntime::personaCard);
                if(target.missing()){log(g,who(p)+" Событие - "+r.eventMoveTitle(MapRuleNode.of(object("id",pending.get("sourceCardId").text())))+": некуда ставить жетоны (пропуск).");g.set("pending",null);r.recalculate(g);return true;}
                while(pending.get("remaining").number()>0){double dv=pending.get("delta").truthy()?pending.get("delta").number():1;if(target.get("shielded").truthy()&&dv>0)dv=Math.max(0,dv-1);if(dv!=0)r.tokens(g,target,dv);pending.set("remaining",pending.get("remaining").number()-1);}
                clear(g,900);return true;
            }
            if(Boolean.TRUE.equals(r.turn("resolveDeferred",g,ctx,""))){delay(g,600);return true;}
            if(!g.get("hasDrawn").truthy()) {
                int discard=Math.max(0,p.get("hand").size()-6);
                if(discard>0){g.set("pending",object("kind","hand_limit_discard_before_draw","playerId",p.get("id").text(),"remaining",discard));delay(g,250);return true;}
                draw(g,p);g.set("hasDrawn",true);
            }
            pending=g.get("pending");
            if(g.get("response").truthy()&&!r.responseExpired(g)){String owner=pending.get("playerId").missing()?pending.get("attackerId").text():pending.get("playerId").text();if(!owner.equals(p.get("id").text()))return true;}
            if(call("botMigratedChoice",g,p,queue,ctx)||call("botRemainingPersona",g,p,nil(),ctx))return true;
            if(pending.truthy()) {
                if(owns(pending,p,"place_tokens_plus_vp")){lateTokens(g,p,pending);return true;}
                if(remainingChoice(g,p,pending))return true;
                if(call("botActionChoice",g,p,nil(),ctx))return true;
                if(owns(pending,p,"persona_26_pick_red_nationalist")){purge(g,p,pending);clear(g,400);return true;}
                if(owns(pending,p,"persona_37_pick_opponent_persona")){bribe(g,p);clear(g,400);return true;}
                if(call("botEventChoice",g,p,nil(),ctx))return true;
                if((pending.get("playerId").truthy()?pending.get("playerId").text():pending.get("attackerId").text()).equals(p.get("id").text())){g.set("pending",null);r.recalculate(g);}
            }
            if(!g.get("hasPlayed").truthy()) {
                Set<String> trio=Set.of("persona_1","persona_19","persona_42");
                boolean onBoard=!first(p.get("coalition"),c->personaCard(c)&&trio.contains(base(c))).missing();
                RuleNode hand=p.get("hand"),c=first(hand,x->personaCard(x)&&trio.contains(base(x))&&onBoard);if(c.missing())c=first(hand,NativeRuntime::personaCard);
                if(!c.missing()) {
                    if(p.get("coalition").size()>=7){extraDraw(g,p,ctx);g.set("hasPlayed",true);delay(g,600);end(g,ctx,queue);return true;}
                    double plays=g.get("playsThisTurn").number(),max=g.get("maxPlaysThisTurn").truthy()?g.get("maxPlaysThisTurn").number():1;
                    if(plays>=max){g.set("hasPlayed",true);return true;}
                    hand.removeAt(find(hand,c.get("id").text()));p.get("coalition").add(c);
                    double dv=g.get("playVpDelta").number();if(dv!=0&&!c.get("_turnPlayVpDeltaApplied").truthy()){c.set("_turnPlayVpDeltaApplied",true);r.tokens(g,c,dv);}
                    g.set("playsThisTurn",plays+1);g.set("hasPlayed",plays+1>=max);
                    String title=JavaGameEngine.accusative(c.get("name").truthy()?c.get("name").text():c.get("text").truthy()?c.get("text").text():c.get("id").text());
                    if(base(c).equals("persona_9")) {
                        RuleNode players=g.get("players");for(int i=0;i<players.size();i++){RuleNode other=players.at(i);if(!other.get("id").text().equals(p.get("id").text())&&other.get("active").truthy()&&other.get("coalition").size()<7){p.get("coalition").removeAt(p.get("coalition").size()-1);other.get("coalition").add(c);log(g,p.get("name").text()+" добавил "+title+" в коалицию "+other.get("name").text());return true;}}
                    }
                    log(g,p.get("name").text()+" добавил "+title+" в коалицию");r.run(g,p,c);r.recalculate(g);r.ability("botPersonaResponse",g,p,c,ctx,p.get("id").text(),"");delay(g,g.get("pending").truthy()?600:1100);
                    if(g.get("pending").truthy())return true;if(!g.get("hasPlayed").truthy()){delay(g,650);return true;}end(g,ctx,queue);return true;
                }
                c=first(hand,x->x.get("type").text().equals("action"));
                if(!c.missing()){hand.removeAt(find(hand,c.get("id").text()));g.get("discard").add(c);g.set("lastAction",c);g.set("hasPlayed",true);r.ability("botActionPlay",g,p,c,ctx,"","");}
                else {extraDraw(g,p,ctx);g.set("hasPlayed",true);}
            }
            if(g.get("hasDrawn").truthy()&&g.get("hasPlayed").truthy())end(g,ctx,queue);
        } catch(RuntimeException ignored) { /* Preserve legacy tick's recovery boundary. */ }
        return true;
    }
    private void extraDraw(RuleNode g,RuleNode p,RuleNode ctx) { Object extra=r.turn("drawTop",g,ctx,p.get("id").text());if(extra instanceof RuleNode c&&c.truthy())g.set("drawsThisTurn",g.get("drawsThisTurn").number()+1); }
    private void lateTokens(RuleNode g,RuleNode p,RuleNode pending) {
        List<RuleNode> candidates=new ArrayList<>();RuleNode cards=p.get("coalition");for(int i=0;i<cards.size();i++)if(personaCard(cards.at(i)))candidates.add(cards.at(i));
        candidates.sort((a,b)->{double[] av=rank(a),bv=rank(b);for(int i=0;i<av.length;i++)if(av[i]!=bv[i])return Double.compare(bv[i],av[i]);return 0;});
        if(candidates.isEmpty())g.set("pending",null);
        else {RuleNode target=candidates.get(0);double delta=pending.get("delta").truthy()?pending.get("delta").number():1;if(target.get("shielded").truthy()&&delta>0)delta=Math.max(0,delta-1);if(delta!=0){r.tokens(g,target,delta);r.recalculate(g);}
            if(pending.get("remaining").number()==4&&pending.get("sourceCardId").text().split("#",2)[0].equals("event_10"))log(g,who(p)+" распределил четыре +1 токена на "+name(target)+".");
            pending.set("remaining",pending.get("remaining").number()-1);if(pending.get("remaining").number()<=0)g.set("pending",null);}
        delay(g,600);
    }
    private static double[] rank(RuleNode c) { return new double[]{c.get("shielded").truthy()?1:0,tagged(c,"persona:immovable")?1:0,c.get("vpDelta").number()>=0?1:0,c.get("vpDelta").number()}; }
    private boolean remainingChoice(RuleNode g,RuleNode p,RuleNode pending) {
        if(!pending.get("playerId").text().equals(p.get("id").text()))return false;
        String kind=pending.get("kind").text();long delay=400;
        switch(kind) {
            case "persona_20_pick_from_discard" -> {RuleNode c=first(g.get("discard"),x->x.get("type").text().equals("action"));if(!c.missing()){g.get("discard").removeAt(find(g.get("discard"),c.get("id").text()));p.get("hand").add(c);log(g,p.get("name").text()+" используя Быкова взял "+r.action(c)+" из сброса.");}}
            case "persona_21_pick_target_invert" -> {RuleNode c=firstGlobal(g,NativeRuntime::eligible);if(!c.missing()){double before=c.get("vpDelta").number(),plus=c.get("plusTokens").missing()?Math.max(0,before):c.get("plusTokens").number(),minus=c.get("minusTokens").missing()?Math.max(0,-before):c.get("minusTokens").number();c.set("plusTokens",minus);c.set("minusTokens",plus);c.set("vpDelta",-before);r.recalculate(g);log(g,who(p)+" ("+pending.get("sourceCardId").text()+") перевернул жетоны на "+name(c)+" ("+num(before)+" → "+num(-before)+").");}}
            case "persona_28_pick_non_fbk" -> {RuleNode self=first(p.get("coalition"),c->base(c).equals("persona_28"));if(!self.missing()){RuleNode target=firstGlobal(g,c->eligible(c)&&!tagged(c,"faction:fbk"));if(!target.missing()){double take=Math.min(3,Math.max(0,target.get("vpDelta").number()));if(take!=0){r.tokens(g,target,-take);r.tokens(g,self,take);}r.recalculate(g);log(g,r.actor(p,"persona_28")+" украл "+num(take)+" × +1 у "+name(target)+".");}}}
            case "persona_33_choose_faction" -> {Map<String,Integer> counts=new LinkedHashMap<>();Set<String> known=Set.of("faction:liberal","faction:rightwing","faction:leftwing","faction:fbk","faction:red_nationalist","faction:system","faction:neutral");RuleNode cards=p.get("coalition");for(int i=0;i<cards.size();i++)if(personaCard(cards.at(i))){RuleNode tags=cards.at(i).get("tags");for(int j=0;j<tags.size();j++)if(tags.at(j).text().startsWith("faction:")){String tag=tags.at(j).text();if(known.contains(tag))counts.merge(tag,1,Integer::sum);break;}}String tag="faction:liberal";int best=-1;for(var e:counts.entrySet())if(e.getValue()>best){tag=e.getKey();best=e.getValue();}RuleNode self=first(cards,c->base(c).equals("persona_33"));if(!self.missing()){self.set("chosenFactionTag",tag);log(g,r.actor(p,"persona_33")+" выбрал фракцию "+tag+".");}delay=250;}
            case "persona_34_guess_topdeck" -> {g.set("pending",null);delay(g,250);return true;}
            case "persona_13_pick_target" -> {RuleNode c=first(player(g,pending.get("attackerId").text()).get("coalition"),NativeRuntime::eligible);if(!c.missing()){r.tokens(g,c,-1);r.recalculate(g);log(g,who(p)+" (Венедитков): дал -1 на "+name(c)+".");}delay=250;}
            default -> {return false;}
        }
        clear(g,delay);return true;
    }
    private void purge(RuleNode g,RuleNode p,RuleNode pending) {
        RuleNode self=first(p.get("coalition"),c->base(c).equals("persona_26")),players=g.get("players");
        for(int i=0;i<players.size();i++){RuleNode cards=players.at(i).get("coalition"),target=first(cards,c->eligible(c)&&tagged(c,"faction:red_nationalist"));if(target.missing())continue;double plus=Math.max(0,target.get("vpDelta").number());cards.removeAt(find(cards,target.get("id").text()));g.get("discard").add(target);r.personaDiscarded(g);if(plus!=0&&!self.missing())r.tokens(g,self,plus);log(g,r.actor(p,"persona_26")+" сбросил "+name(target)+" и унаследовал "+num(plus)+" × +1.");return;}
        log(g,who(p)+" ("+pending.get("sourceCardId").text()+"): нет красн.нац. для сброса.");
    }
    private void bribe(RuleNode g,RuleNode p) {
        Set<String> passive=Set.of("persona_2","persona_4","persona_6","persona_15","persona_18","persona_22","persona_24","persona_25","persona_27","persona_29","persona_38","persona_43","persona_44");
        RuleNode best=nil(),players=g.get("players");double score=-1;
        for(int i=0;i<players.size();i++){RuleNode other=players.at(i);if(other.get("id").text().equals(p.get("id").text()))continue;RuleNode cards=other.get("coalition");for(int j=0;j<cards.size();j++){RuleNode c=cards.at(j);if(!eligible(c))continue;double n=(c.get("abilityKey").truthy()?3:0)+(passive.contains(base(c))?2:0)+Math.min(3,Math.max(0,c.get("baseVp").number())/2);if(n>score){score=n;best=c;}}}
        if(best.missing())log(g,r.actor(p,"persona_37")+": нет цели для подкупа.");
        else {r.tokens(g,best,2);best.set("blockedAbilities",true);r.recalculate(g);log(g,r.actor(p,"persona_37")+" подкупил "+name(best)+" (+2) и навсегда заблокировал способности.");}
    }
}
