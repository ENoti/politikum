package com.politikum.engine;

import static com.politikum.engine.GameState.object;

/** Shared persona 14/40 and event selection rules. */
public final class JavaSharedPersonaRules {
    private final JavaAbilityRules.Scoring scoring;
    private final AbilityEffects effects;
    public JavaSharedPersonaRules(JavaAbilityRules.Scoring scoring,AbilityEffects effects) { this.scoring=scoring;this.effects=effects; }
    private static String base(RuleNode c) { return c.get("id").text().split("#",2)[0]; }
    private static String title(RuleNode c) { return c.get("name").truthy()?c.get("name").text():c.get("id").text(); }
    private static String who(RuleNode p) { return p.get("name").text().equals("You")?"Вы":p.get("name").text(); }
    private static String num(double n) { return Double.isFinite(n)?String.valueOf(JavaScoringRules.numeric(n)):Double.toString(n); }
    private static int find(RuleNode cards,String id) { for(int i=0;i<cards.size();i++) if(cards.at(i).get("id").text().equals(id))return i;return -1; }
    private static RuleNode player(RuleNode g,String id) { return g.get("players").at(find(g.get("players"),id)); }
    public void enterDiscard(RuleNode g,RuleNode me,RuleNode c) {
        g.set("pending",object("kind","discard_one_persona_from_any_coalition","playerId",me.get("id").text(),"sourceCardId",c.get("id").text()));
        g.get("log").add(who(me)+" ("+title(c)+"): выберите персону в любой коалиции для сброса.");
    }
    public void enterTokens(RuleNode g,RuleNode me,RuleNode c) {
        double tokens=c.get("params").get("tokens").missing()?1:c.get("params").get("tokens").number();
        double delta=c.get("params").get("delta").missing()?1:c.get("params").get("delta").number();
        String bid=base(c); boolean any=false;RuleNode cards=me.get("coalition");
        for(int i=0;i<cards.size();i++) if(cards.at(i).get("type").text().equals("persona"))any=true;
        if(!any) {
            g.get("log").add(bid.equals("event_1")?who(me)+" как жаль что ЭКОКРЕДИТЫ некуда ставить!":bid.equals("event_3")?me.get("name").text()+" не кому было отдать госдеповские гранты!":who(me)+" Событие - "+effects.eventTitle(c)+": некуда ставить жетоны (пропуск).");return;
        }
        g.set("pending",object("kind","place_tokens_plus_vp","playerId",me.get("id").text(),"remaining",JavaScoringRules.numeric(tokens),"delta",JavaScoringRules.numeric(delta),"sourceCardId",c.get("id").text()));
        String message;
        if(bid.equals("event_1")&&tokens==3&&delta==1) message="\"Экокредиты\": поставьте 3 жетон(ов) (+1) на свою коалицию.";
        else if(bid.equals("event_2")&&tokens==2&&delta==1) message=me.get("name").text()+" попался Сладкий Подарок: поставьте 2 жетона (+1) на свою коалицию.";
        else if(bid.equals("event_3")&&tokens==5&&delta==1) message=me.get("name").text()+" Грант Госдепа: поставьте 5 жетон(ов) (+1) на свою коалицию.";
        else if(bid.equals("event_10")&&tokens==4&&delta==1) message=me.get("name").text()+" распредилил четыре +1 токена";
        else {
            String prefix=bid.equals("persona_40")&&tokens==3&&delta==1?"использовала способность Дунцовой":effects.eventTitle(c);
            message=who(me)+" "+prefix+": поставьте "+num(tokens)+" жетон(ов) ("+(delta>0?"+":"")+num(delta)+") на свою коалицию.";
        }
        g.get("log").add(message);
    }
    public boolean tokens(RuleNode g,String actor,String id) {
        effects.expire(g);
        RuleNode pending=g.get("pending"),me=player(g,actor);
        if(!pending.get("kind").text().equals("place_tokens_plus_vp")||!pending.get("playerId").text().equals(actor)||me.missing())return false;
        RuleNode c=me.get("coalition").at(find(me.get("coalition"),id));if(c.missing())return false;
        double burst=Math.max(1,pending.get("remaining").truthy()?pending.get("remaining").number():1);
        double delta=(pending.get("delta").truthy()?pending.get("delta").number():1)*burst;
        if(c.get("shielded").truthy()&&delta>0&&!pending.get("shieldTaxApplied").truthy()) { delta=Math.max(0,delta-1);pending.set("shieldTaxApplied",true); }
        if(delta==0||Double.isNaN(delta))g.get("log").add(who(me)+" выбрал защищённого персонажа ("+title(c)+"); +1 не сработал.");
        else scoring.tokens(g,c,delta);
        double left=Math.max(0,pending.get("remaining").number()-burst);pending.set("remaining",left);
        g.get("log").add(who(me)+" поставил +"+num(delta)+" на "+title(c)+". (осталось: "+num(left)+")");
        if(left<=0) { g.set("pending",null);try{effects.expire(g);}catch(RuntimeException ignored){} }
        scoring.recalculate(g);return true;
    }
    public boolean discard(RuleNode g,RuleNode ctx,String actor,RuleNode args) {
        if(g.get("response").truthy()&&effects.responseExpired(g))g.set("response",null);
        RuleNode pending=g.get("pending");
        if(!pending.get("kind").text().equals("discard_one_persona_from_any_coalition")||!pending.get("playerId").text().equals(actor)||!ctx.get("currentPlayer").text().equals(actor))return false;
        RuleNode owner=player(g,args.at(0).text()),cards=owner.get("coalition");int i=find(cards,args.at(1).text());if(owner.missing()||i<0)return false;
        RuleNode c=cards.at(i);if(!c.get("type").text().equals("persona")||c.get("shielded").truthy())return false;
        cards.removeAt(i);g.get("discard").add(c);scoring.personaDiscarded(g);
        RuleNode me=player(g,actor);String source=pending.get("sourceCardId").text();String name=source.isEmpty()?"":effects.cardTitle(source);
        g.get("log").add((me.get("name").truthy()?who(me):actor)+(name.isEmpty()?" ":" использовал способность "+name+": ")+"сбросил "+title(c)+" из коалиции "+owner.get("name").text()+".");
        g.set("pending",null);scoring.recalculate(g);return true;
    }
}
