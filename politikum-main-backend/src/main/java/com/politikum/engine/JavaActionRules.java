package com.politikum.engine;

import java.util.Set;
import static com.politikum.engine.GameState.object;

/** Action play, target validation and bot action effects. */
public final class JavaActionRules {
    private final JavaAbilityRules.Scoring scoring;
    private final JavaAbilityRules.Titles titles;
    private final AbilityEffects effects;
    private final JavaResponseRules responses;
    public JavaActionRules(JavaAbilityRules.Scoring scoring, JavaAbilityRules.Titles titles, AbilityEffects effects, JavaResponseRules responses) {
        this.scoring=scoring;this.titles=titles;this.effects=effects;this.responses=responses;
    }
    private static int find(RuleNode cards,String id) { for(int i=0;i<cards.size();i++)if(cards.at(i).get("id").text().equals(id))return i;return -1; }
    private static RuleNode player(RuleNode g,String id) { return g.get("players").at(find(g.get("players"),id)); }
    private static boolean persona(RuleNode c) { return c.get("type").text().equals("persona"); }
    private static String base(RuleNode c) { return c.get("id").text().split("#",2)[0]; }
    private static String title(RuleNode c) { return c.get("name").truthy()?c.get("name").text():c.get("id").text(); }
    private static String who(RuleNode p) { return p.get("name").text().equals("You")?"Вы":p.get("name").text(); }
    private static String actor(RuleNode p,String id) { return p.get("name").truthy()?who(p):id; }
    private static void log(RuleNode g,String text) { g.get("log").add(text); }
    private static boolean eligible(RuleNode c) { return persona(c)&&!base(c).equals("persona_31")&&!c.get("shielded").truthy(); }
    private static boolean special17(RuleNode c) { return Set.of("persona_3","persona_38","persona_41","persona_43").contains(base(c)); }
    private static String choiceKind(int n) { return switch(n) {
        case 7 -> "action_7_block_persona";case 13 -> "action_13_shield_persona";
        case 17 -> "action_17_choose_opponent_persona";case 18 -> "action_18_pick_persona_from_discard";
        default -> throw new IllegalArgumentException("Action choice: "+n);
    }; }
    private void clearExpired(RuleNode g) { if(g.get("response").truthy()&&effects.responseExpired(g))g.set("response",null); }
    private void finish(RuleNode g,RuleNode ctx,RuleNode events) {
        effects.triggerRoundEnd(g,ctx);
        if(!effects.endRound(g,ctx))events.add(object("type","endTurn","payload",null));
    }
    private void discard(RuleNode g,RuleNode cards,int index) {
        RuleNode c=cards.removeAt(index);g.get("discard").add(c);if(persona(c))scoring.personaDiscarded(g);
    }
    private static void resetTokens(RuleNode c) {
        c.set("vpDelta",0);c.set("plusTokens",0);c.set("minusTokens",0);c.set("passiveVpDelta",0);
        c.set("vp",JavaScoringRules.numeric(c.get("baseVp").missing()?0:c.get("baseVp").number()));
    }
    private boolean hasRetaliation(RuleNode target,RuleNode attacker) {
        boolean p13=false,hasPersona=false;
        RuleNode cards=target.get("coalition");for(int i=0;i<cards.size();i++)if(base(cards.at(i)).equals("persona_13"))p13=true;
        cards=attacker.get("coalition");for(int i=0;i<cards.size();i++)if(persona(cards.at(i)))hasPersona=true;
        return p13&&!attacker.missing()&&hasPersona;
    }
    private void botRetaliation(RuleNode g,RuleNode target,RuleNode attacker) {
        if(!hasRetaliation(target,attacker))return;
        RuleNode cards=attacker.get("coalition");
        for(int i=0;i<cards.size();i++)if(eligible(cards.at(i))) {
            RuleNode c=cards.at(i);scoring.tokens(g,c,-1);scoring.recalculate(g);
            log(g,target.get("name").text()+" (Венедитков): дал -1 на "+title(c)+".");return;
        }
    }
    public boolean play(RuleNode g,RuleNode ctx,RuleNode events,String actorId,String cardId,String targetId) {
        effects.expire(g);
        RuleNode me=player(g,actorId);if(me.missing())return false;
        RuleNode hand=me.get("hand");int idx=find(hand,cardId);RuleNode c=hand.at(idx);
        if(responses.handles(g,c,ctx,actorId))return responses.action(g,me,c,ctx,actorId);
        if(g.get("pending").truthy()||!g.get("hasDrawn").truthy()||g.get("hasPlayed").truthy()
            ||g.get("response").truthy()&&!effects.responseExpired(g)||idx<0||!c.get("type").text().equals("action"))return false;
        String bid=base(c);
        if(Set.of("action_6","action_8","action_14").contains(bid))return false;
        if(bid.equals("action_4")||bid.equals("action_9")) {
            RuleNode target=player(g,targetId);if(target.missing()||targetId.equals(actorId))return false;
            hand.removeAt(idx);responses.openAction(g,target,c,actorId,true);g.set("lastAction",c);g.set("hasPlayed",true);
            boolean onlyPersona=bid.equals("action_9");
            g.set("pending",object("kind",onlyPersona?"action_9_discard_persona":"action_4_discard","attackerId",actorId,"targetId",targetId,"sourceCardId",c.get("id").text()));
            log(g,who(me)+" разыграл "+(onlyPersona?"Вывод во внешний контур":"\""+titles.action(c)+"\"")+" на "+target.get("name").text()+".");
            // Name-based immediate bot resolution intentionally differs from human targeting.
            if(target.get("name").text().startsWith("[B]")) {
                RuleNode cards=target.get("coalition");int dropIndex=cards.size()>0?0:-1;
                if(onlyPersona) { dropIndex=-1;for(int i=0;i<cards.size();i++)if(persona(cards.at(i))){dropIndex=i;break;} }
                if(dropIndex>=0) {
                    RuleNode drop=cards.at(dropIndex);discard(g,cards,dropIndex);
                    log(g,target.get("name").text()+" сбросил "+title(drop)+" из коалиции.");
                } else log(g,target.get("name").text()+(onlyPersona?" had no persona to discard.":" had no Coalition cards to discard."));
                g.set("pending",null);botRetaliation(g,target,me);finish(g,ctx,events);
            }
            return true;
        }
        hand.removeAt(idx);g.get("discard").add(c);g.set("lastAction",c);
        if(bid.equals("action_5")) {
            log(g,who(me)+" разыграли культуру политики в восточной европе: разыграйте до 2-ух персонажей, но каждый выходит с -1");
            g.set("maxPlaysThisTurn",2);g.set("playVpDelta",-1);return true;
        }
        g.set("hasPlayed",true);
        if(Set.of("action_7","action_13","action_17","action_18").contains(bid)) {
            int n=Integer.parseInt(bid.substring(7));
            if(n==18) {
                boolean valid=false;RuleNode cards=g.get("discard");for(int i=0;i<cards.size();i++)if(persona(cards.at(i))&&!base(cards.at(i)).equals("persona_31"))valid=true;
                if(!valid) { g.set("pending",null);log(g,who(me)+" разыграл "+title(c)+", но в сбросе нет подходящих персонажей.");finish(g,ctx,events);return true; }
            }
            g.set("pending",object("kind",choiceKind(n),"attackerId",actorId));
            if(n==7)log(g,who(me)+" сыграл «ИНОАГЕНТ»: выберите персону в любой коалиции.");
            if(n==13) { String name=titles.action(c);log(g,who(me)+" разыграл «"+(name.isEmpty()?"Белое пальто":name)+"»: защищает одного из ваших персонажей."); }
            if(n==17)responses.openAction(g,me,c,actorId,false);
            return true;
        }
        log(g,me.get("name").text()+" played ACTION "+title(c)+".");finish(g,ctx,events);return true;
    }
    public boolean choose(int n,RuleNode g,RuleNode ctx,RuleNode events,String actorId,String ownerId,String id) {
        clearExpired(g);RuleNode pending=g.get("pending");
        if(!pending.get("kind").text().equals(choiceKind(n))||!pending.get("attackerId").text().equals(actorId))return false;
        RuleNode me=player(g,actorId),owner=me;
        if(n==7)owner=player(g,ownerId);
        if(n==17) {
            owner=g.get("players").at(-1);RuleNode players=g.get("players");
            for(int i=0;i<players.size();i++)if(!players.at(i).get("id").text().equals(actorId)&&find(players.at(i).get("coalition"),id)>=0){owner=players.at(i);break;}
        }
        RuleNode cards=n==18?g.get("discard"):owner.get("coalition");int idx=find(cards,id);RuleNode target=cards.at(idx);
        if(idx<0||!persona(target)||(n!=18&&owner.missing()))return false;
        if(n==7) {
            if(base(target).equals("persona_36")) {
                scoring.tokens(g,target,4);scoring.recalculate(g);
                log(g,actor(me,actorId)+" выдал "+title(target)+" статус ИНОАГЕНТА, но тот проигнорировал и получил +4.");
            } else {
                resetTokens(target);scoring.recalculate(g);target.set("blockedAbilities",true);target.set("blockedBy","action_7");
                log(g,actor(me,actorId)+" выдал "+title(target)+" статус ИНОАГЕНТА: способности заблокированы, жетоны сброшены.");
            }
        } else if(n==13) {
            target.set("shielded",true);target.set("shieldedBy","action_13");
            log(g,who(me)+" разыграл Белое пальто на "+title(target));
        } else if(n==17) {
            if(target.get("shielded").truthy())return false;
            int amount=special17(target)?4:2;scoring.tokens(g,target,-amount);
            String name=titles.action(g.get("lastAction"));
            log(g,actor(me,actorId)+" использовал "+(name.isEmpty()?"ACTION 17":name)+" на "+title(target)+": "+amount+" × -1.");
        } else {
            if(base(target).equals("persona_31"))return false;
            cards.removeAt(idx);if(me.missing())return false;me.get("hand").add(target);
            log(g,who(me)+" вернул "+title(target)+" из сброса в руку используя \"воскресить политический труп\".");
        }
        g.set("pending",null);if(n==17)scoring.recalculate(g);finish(g,ctx,events);return true;
    }
    public boolean discardChoice(RuleNode g,RuleNode ctx,RuleNode events,String actorId,String id) {
        clearExpired(g);RuleNode pending=g.get("pending");String kind=pending.get("kind").text();
        if(!Set.of("action_4_discard","action_9_discard_persona").contains(kind)||!pending.get("targetId").text().equals(actorId))return false;
        RuleNode target=player(g,actorId),cards=target.get("coalition");int idx=find(cards,id);RuleNode drop=cards.at(idx);
        if(target.missing()||idx<0||kind.equals("action_9_discard_persona")&&!persona(drop)
            ||persona(drop)&&base(drop).equals("persona_31")||drop.get("shielded").truthy())return false;
        discard(g,cards,idx);log(g,target.get("name").text()+" сбросил "+title(drop)+" из коалиции.");g.set("pending",null);
        RuleNode attacker=player(g,pending.get("attackerId").text());
        if(hasRetaliation(target,attacker)) {
            g.set("pending",object("kind","persona_13_pick_target","playerId",target.get("id").text(),"attackerId",attacker.get("id").text(),"sourceCardId",pending.get("sourceCardId").text()));return true;
        }
        finish(g,ctx,events);return true;
    }
    public boolean botChoice(RuleNode g,RuleNode me) {
        // Keep the legacy bot-specific target filters and missing blockedBy/shieldedBy
        // markers. In particular, bot action 7 does not apply persona 36's human bonus.
        RuleNode pending=g.get("pending");String kind=pending.get("kind").text();int n=0;
        for(int candidate:new int[]{7,13,17,18})if(kind.equals(choiceKind(candidate)))n=candidate;
        if(n==0||!pending.get("attackerId").text().equals(me.get("id").text()))return false;
        RuleNode target=me.get("coalition").at(-1);
        if(n==18) {
            RuleNode cards=g.get("discard");for(int i=0;i<cards.size();i++)if(persona(cards.at(i))&&!base(cards.at(i)).equals("persona_31")) {
                target=cards.removeAt(i);me.get("hand").add(target);log(g,who(me)+" вернул "+title(target)+" из сброса в руку (ACTION 18).");break;
            }
        } else {
            RuleNode players=g.get("players");
            for(int i=0;i<players.size()&&target.missing();i++) {
                RuleNode p=players.at(i);boolean self=p.get("id").text().equals(me.get("id").text());
                if(n==13&&!self||n==17&&self)continue;
                RuleNode cards=p.get("coalition");for(int j=0;j<cards.size();j++)if(n==13?persona(cards.at(j)):eligible(cards.at(j))) {target=cards.at(j);break;}
            }
            if(!target.missing()) {
                if(n==7) { resetTokens(target);target.set("blockedAbilities",true);scoring.recalculate(g);log(g,who(me)+" (ACTION 7): заблокировал "+title(target)+"."); }
                if(n==13) { target.set("shielded",true);log(g,who(me)+" защитил "+title(target)+" (ACTION 13)."); }
                if(n==17) { int amount=special17(target)?4:2;scoring.tokens(g,target,-amount);scoring.recalculate(g);log(g,who(me)+" использовал Ася Несоевая на "+title(target)+": "+amount+" × -1."); }
            } else if(n==17)log(g,who(me)+" использовал Ася Несоевая, но не нашёл цели.");
        }
        g.set("pending",null);scoring.recalculate(g);g.set("botNextActAtMs",effects.now()+(n==13?250:400));return true;
    }
    public void botPlay(RuleNode g,RuleNode me,RuleNode c) {
        // The scheduler already removed/discarded the card. Legacy bots only resolve
        // actions 5/13 here; other action cards retain their generic play behavior.
        if(base(c).equals("action_13")) {
            RuleNode cards=me.get("coalition"),target=cards.at(-1);
            for(int i=0;i<cards.size();i++)if(persona(cards.at(i))&&!cards.at(i).get("shielded").truthy()){target=cards.at(i);break;}
            if(!target.missing()) { target.set("shielded",true);target.set("shieldedBy","action_13");log(g,me.get("name").text()+" разыграл Белое пальто на "+title(target)); }
            else log(g,me.get("name").text()+" разыграл Белое пальто, но в коалиции нет подходящей персоны");
        } else if(base(c).equals("action_5")) {
            g.set("maxPlaysThisTurn",2);g.set("playVpDelta",-1);g.set("hasPlayed",false);
            log(g,me.get("name").text()+" разыграл культуру политики в восточной европе: разыграйте до 2-ух персонажей, но каждый выходит с -1");
        } else log(g,me.get("name").text()+" played ACTION "+title(c)+".");
    }
}
