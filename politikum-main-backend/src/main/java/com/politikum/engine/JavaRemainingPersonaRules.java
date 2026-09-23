package com.politikum.engine;

import java.util.*;
import static com.politikum.engine.GameState.object;

/** Remaining persona entry effects, choices, event vacuum and deck recycling. */
public final class JavaRemainingPersonaRules {
    private final JavaAbilityRules.Scoring scoring;
    private final AbilityEffects effects;
    public JavaRemainingPersonaRules(JavaAbilityRules.Scoring scoring, AbilityEffects effects) {
        this.scoring=scoring; this.effects=effects;
    }
    private static String base(RuleNode c) { return c.get("id").text().split("#",2)[0]; }
    private static boolean persona(RuleNode c) { return c.get("type").text().equals("persona"); }
    private static boolean tag(RuleNode c,String tag) {
        RuleNode tags=c.get("tags");
        for(int i=0;i<tags.size();i++) if(tags.at(i).text().equals(tag)) return true;
        return false;
    }
    private static RuleNode player(RuleNode g,String id) {
        RuleNode players=g.get("players");
        for(int i=0;i<players.size();i++) if(players.at(i).get("id").text().equals(id)) return players.at(i);
        return players.at(-1);
    }
    private static RuleNode source(RuleNode me,String id) {
        RuleNode cards=me.get("coalition");
        for(int i=0;i<cards.size();i++) if(base(cards.at(i)).equals(id)) return cards.at(i);
        return cards.at(-1);
    }
    private static String who(RuleNode p) { return p.get("name").text().equals("You")?"Вы":p.get("name").text(); }
    private static String title(RuleNode c) { return c.get("name").truthy()?c.get("name").text():c.get("id").text(); }
    private static String num(double n) { return Double.isFinite(n)?String.valueOf(JavaScoringRules.numeric(n)):Double.toString(n); }
    private static String drew(RuleNode p) { String n=p.get("name").text(); return n.endsWith("а")||n.endsWith("я")?"вытянула":"вытянул"; }
    public void enter(int n,RuleNode g,RuleNode me,RuleNode card) {
        if(n==3||n==23) {
            g.set("pending",object("kind",n==3?"persona_3_choice":"persona_23_choose_self_inflict_draw","playerId",me.get("id").text(),"sourceCardId",card.get("id").text()));
            if(n==23) { g.get("pending").set("taken",0); g.get("log").add(effects.actor(me,"persona_23")+": выберите 0..3 жетона -1 для себя, затем доберите столько же карт."); }
            return;
        }
        if(n==6) { g.get("log").add(who(me)+" ("+title(card)+") пассивка: получает +1 когда кого-то обвинили в работе на кремль."); return; }
        int affected=0;
        if(n==30||n==41) {
            RuleNode cards=me.get("coalition");
            for(int i=0;i<cards.size();i++) {
                RuleNode c=cards.at(i);
                if(persona(c)&&tag(c,n==30?"faction:liberal":"faction:fbk")) { scoring.simple(c,1); affected++; }
            }
            g.get("log").add(n==30?who(me)+" ("+title(card)+") усилил "+affected+" либерал(ов) в своей коалиции (+1).":me.get("name").text()+" ("+title(card)+") buffed "+affected+" FBK persona(s) in their coalition (+1).");
        } else if(n==43) {
            RuleNode players=g.get("players");
            for(int i=0;i<players.size();i++) {
                RuleNode cards=players.at(i).get("coalition");
                for(int j=0;j<cards.size();j++) {
                    RuleNode c=cards.at(j);
                    if(persona(c)&&tag(c,"faction:rightwing")&&c.get("vpDelta").number()>0) { scoring.simple(c,-1); affected++; }
                }
            }
            if(affected>0) scoring.simple(card,affected);
            g.get("log").add(who(me)+" ("+title(card)+") высосал "+affected+" × +1 у правых.");
        }
    }
    public void vacuum(RuleNode g,RuleNode event) {
        String bid=base(event);
        if(!Set.of("event_1","event_2","event_3","event_10").contains(bid)) return;
        RuleNode pending=g.get("pending");
        if(!pending.get("kind").text().equals("place_tokens_plus_vp")||!pending.get("sourceCardId").text().split("#",2)[0].equals(bid)) return;
        List<RuleNode> cards=new ArrayList<>(); RuleNode players=g.get("players");
        for(int i=0;i<players.size();i++) {
            RuleNode coalition=players.at(i).get("coalition");
            for(int j=0;j<coalition.size();j++) if(base(coalition.at(j)).equals("persona_38")) cards.add(coalition.at(j));
        }
        double take=Math.min(cards.size(),Math.max(0,pending.get("remaining").number()));
        for(int i=0;i<take;i++) scoring.tokens(g,cards.get(i),1);
        if(take>0) {
            double left=Math.max(0,pending.get("remaining").number()-take); pending.set("remaining",left);
            if(left<=0) g.set("pending",null);
            g.get("log").add((take==1?"VotVot":num(take)+"× VotVot")+" забрал "+num(take)+" жетон(ов) из события "+effects.eventBaseTitle(bid)+". (осталось: "+num(left)+")");
        }
    }
    public void globalEnter22(RuleNode g,RuleNode card) {
        if(base(card).equals("persona_22"))return;
        int delta=tag(card,"faction:liberal")?-1:tag(card,"faction:rightwing")?2:0;
        if(delta==0)return;
        RuleNode players=g.get("players");
        for(int i=0;i<players.size();i++) {
            RuleNode cards=players.at(i).get("coalition");
            for(int j=0;j<cards.size();j++)if(base(cards.at(j)).equals("persona_22"))scoring.tokens(g,cards.at(j),delta);
        }
    }
    public boolean choose23(RuleNode g,String actor,double want) {
        RuleNode pending=g.get("pending"),me=player(g,actor),self=source(me,"persona_23");
        if(!pending.get("kind").text().equals("persona_23_choose_self_inflict_draw")||!pending.get("playerId").text().equals(actor)||me.missing()||self.missing()) return false;
        double already=Math.max(0,Math.min(3,pending.get("taken").number()));
        if(want==0) { g.set("pending",null); scoring.recalculate(g); return true; }
        double k=Math.max(0,Math.min(Math.max(0,3-already),want));
        if(k==0||Double.isNaN(k)) return false;
        scoring.tokens(g,self,-k);
        for(int i=0;i<k&&g.get("deck").size()>0;i++) {
            RuleNode next=g.get("deck").removeAt(0); if(!next.truthy()) break;
            if(next.get("type").text().equals("event")) {
                JavaEventRules.markLastEvent(g,me,next);
                g.get("log").add(who(me)+" "+drew(me)+" "+effects.eventMoveTitle(next)+" из-за способности Волкова.");
                effects.run(g,me,next); vacuum(g,next);
                if(g.get("pending").truthy()) break;
                g.get("discard").add(next);
            } else {
                me.get("hand").add(next); g.get("log").add(who(me)+" взял карту из-за способности Волкова.");
            }
        }
        pending.set("taken",already+k);
        g.get("log").add(effects.actor(me,"persona_23")+" взял "+num(k)+" × -1 и вытянул "+num(k)+" карт. (total "+num(already+k)+"/3)");
        if(!g.get("pending").truthy()||g.get("pending").get("kind").text().equals("persona_23_choose_self_inflict_draw")) if(already+k>=3) g.set("pending",null);
        scoring.recalculate(g); return true;
    }
    public boolean recycle39(RuleNode g,RuleNode ctx,String actor) {
        if(!ctx.get("phase").text().equals("action")||!ctx.get("currentPlayer").text().equals(actor)||g.get("pending").truthy()) return false;
        RuleNode me=player(g,actor),self=source(me,"persona_39"); if(me.missing()||self.missing()) return false;
        RuleNode cards=me.get("coalition");
        for(int i=0;i<cards.size();i++) if(base(cards.at(i)).equals("persona_39")) { cards.removeAt(i); break; }
        RuleNode deck=g.get("deck"); deck.add(self);
        List<RuleNode> shuffled=new ArrayList<>(); for(int i=0;i<deck.size();i++) shuffled.add(deck.at(i));
        for(int i=shuffled.size()-1;i>0;i--) Collections.swap(shuffled,i,(int)Math.floor(effects.random()*(i+1)));
        g.set("deck",List.of()); for(RuleNode c:shuffled) g.get("deck").add(c);
        int buffed=0;
        for(int i=0;i<cards.size();i++) if(persona(cards.at(i))&&tag(cards.at(i),"faction:red_nationalist")) { scoring.tokens(g,cards.at(i),2); buffed++; }
        scoring.recalculate(g);
        g.get("log").add(effects.actor(me,"persona_39")+" вернул себя в колоду и усилил "+buffed+" красн.нац. персонаж(ей) (+2)."); return true;
    }
    public boolean choose3(RuleNode g,RuleNode ctx,String actor,RuleNode args,boolean skip) {
        RuleNode pending=g.get("pending"),me=player(g,actor);
        if(!pending.get("kind").text().equals("persona_3_choice")||!pending.get("playerId").text().equals(actor)||!ctx.get("currentPlayer").text().equals(actor)||me.missing()) return false;
        boolean changed=false;
        if(skip) g.get("log").add(who(me)+" пропустил способность персонажа 3.");
        else if(args.at(0).text().equals("a")) {
            RuleNode owner=player(g,args.at(1).text()); if(owner.missing()) return false;
            RuleNode cards=owner.get("coalition"); int j=-1;
            for(int i=0;i<cards.size();i++) if(args.at(2).truthy()&&cards.at(i).get("id").text().equals(args.at(2).text())) { j=i; break; }
            if(j<0) for(int i=0;i<cards.size();i++) if(persona(cards.at(i))&&tag(cards.at(i),"faction:leftwing")) { j=i; break; }
            RuleNode c=cards.at(j); if(j<0||!persona(c)||!tag(c,"faction:leftwing")||c.get("shielded").truthy()) return false;
            cards.removeAt(j);g.get("discard").add(c);scoring.personaDiscarded(g);changed=true;
            g.get("log").add(who(me)+" ("+pending.get("sourceCardId").text()+"): сбросил "+title(c)+" (левые) у "+owner.get("name").text()+".");
        } else {
            double removed=removeLeftTokens(g,actor); changed=removed>0;
            g.get("log").add(who(me)+" ("+pending.get("sourceCardId").text()+"): снял "+num(removed)+" × +1 с левых у соперников.");
        }
        RuleNode self=source(me,"persona_3"); if(changed&&!self.missing()) scoring.tokens(g,self,-1);
        g.set("pending",null);scoring.recalculate(g);return true;
    }
    private double removeLeftTokens(RuleNode g,String actor) {
        double removed=0;RuleNode players=g.get("players");
        for(int i=0;i<players.size();i++) {
            RuleNode p=players.at(i);if(p.get("id").text().equals(actor))continue;
            RuleNode cards=p.get("coalition");
            for(int j=0;j<cards.size();j++) if(persona(cards.at(j))&&tag(cards.at(j),"faction:leftwing")) {
                double take=Math.min(2,Math.max(0,cards.at(j).get("vpDelta").number()));
                if(take>0) { scoring.tokens(g,cards.at(j),-take);removed+=take; }
            }
        }
        return removed;
    }
    public boolean bot(RuleNode g,RuleNode me) {
        RuleNode pending=g.get("pending");String actor=me.get("id").text(),kind=pending.get("kind").text();
        if(!pending.get("playerId").text().equals(actor)) return false;
        if(kind.equals("persona_3_choice")) {
            boolean found=false;RuleNode players=g.get("players");
            outer:for(int i=0;i<players.size();i++) {
                RuleNode owner=players.at(i),cards=owner.get("coalition");
                for(int j=0;j<cards.size();j++) {
                    RuleNode c=cards.at(j);if(!persona(c)||!tag(c,"faction:leftwing")||c.get("shielded").truthy()) continue;
                    cards.removeAt(j);g.get("discard").add(c);
                    g.get("log").add(who(me)+" ("+pending.get("sourceCardId").text()+"): сбросил "+title(c)+" (левые) у "+owner.get("name").text()+".");found=true;break outer;
                }
            }
            if(!found) g.get("log").add(who(me)+" ("+pending.get("sourceCardId").text()+"): снял "+num(removeLeftTokens(g,actor))+" × +1 с левых у соперников.");
        } else if(kind.equals("persona_23_choose_self_inflict_draw")) {
            RuleNode self=source(me,"persona_23");int k=self.missing()?0:2;if(k>0)scoring.tokens(g,self,-k);
            for(int i=0;i<k&&g.get("deck").size()>0;i++) {
                RuleNode next=g.get("deck").removeAt(0);if(!next.truthy())break;
                if(next.get("type").text().equals("event")) {
                    JavaEventRules.markLastEvent(g,me,next);g.get("log").add(who(me)+" "+drew(me)+" "+effects.eventMoveTitle(next)+" (из \""+effects.cardTitle(pending.get("sourceCardId").text())+"\")");
                    effects.run(g,me,next);vacuum(g,next);g.get("discard").add(next);
                } else { me.get("hand").add(next);g.get("log").add(who(me)+" взял карту из "+pending.get("sourceCardId").text()+"."); }
            }
            g.get("log").add(effects.actor(me,"persona_23")+" взял "+k+" × -1 и вытянул "+k+" карт.");
        } else return false;
        g.set("pending",null);scoring.recalculate(g);g.set("botNextActAtMs",effects.now()+(kind.equals("persona_3_choice")?400:600));return true;
    }
}
