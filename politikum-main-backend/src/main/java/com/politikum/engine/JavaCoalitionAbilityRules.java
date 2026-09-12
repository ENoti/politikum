package com.politikum.engine;

import static com.politikum.engine.GameState.object;

/** Coalition choices for personas 5, 7 and 11. Lifecycle is delegated to JavaTurnRules. */
public final class JavaCoalitionAbilityRules {
    private final JavaAbilityRules.Scoring scoring;
    public JavaCoalitionAbilityRules(JavaAbilityRules.Scoring scoring) { this.scoring = scoring; }
    private static int find(RuleNode cards, String id) {
        for (int i=0;i<cards.size();i++) if(cards.at(i).get("id").text().equals(id)) return i;
        return -1;
    }
    private static RuleNode player(RuleNode g,String id) { return g.get("players").at(find(g.get("players"),id)); }
    private static String base(RuleNode c) { return c.get("id").text().split("#",2)[0]; }
    private static int source(RuleNode me,String id) {
        RuleNode cards=me.get("coalition");
        for(int i=0;i<cards.size();i++) if(base(cards.at(i)).equals(id)) return i;
        return -1;
    }
    private static String title(RuleNode c) { return c.get("name").truthy()?c.get("name").text():c.get("id").text(); }
    private static String who(RuleNode me) { return me.get("name").text().equals("You")?"Вы":me.get("name").text(); }
    private static boolean liberal(RuleNode c) {
        RuleNode tags=c.get("tags");
        for(int i=0;i<tags.size();i++)if(tags.at(i).text().equals("faction:liberal"))return true;
        return false;
    }
    private static boolean targets(RuleNode g,RuleNode me,boolean onlyLiberal) {
        RuleNode players=g.get("players");
        for(int i=0;i<players.size();i++) {
            RuleNode owner=players.at(i); if(owner.get("id").text().equals(me.get("id").text()))continue;
            RuleNode cards=owner.get("coalition");
            for(int j=0;j<cards.size();j++) {
                RuleNode c=cards.at(j);
                if(c.get("type").text().equals("persona")&&!base(c).equals("persona_31")&&!c.get("shielded").truthy()&&(!onlyLiberal||liberal(c)))return true;
            }
        }
        return false;
    }
    public void enter(int n,RuleNode g,RuleNode me,RuleNode card) {
        if(n==5&&!targets(g,me,true)) {g.get("log").add("Ни одного либерала на всю игру. Это провал!");return;}
        g.set("pending",object("kind",n==5?"persona_5_pick_liberal":"persona_7_swap_two_in_coalition","playerId",me.get("id").text(),"sourceCardId",card.get("id").text()));
        if(n==7)g.get("log").add(who(me)+" использовали способность Каспарова: выберите коалицию и двух персон для перестановки.");
    }
    public boolean choose(String op,RuleNode g,RuleNode ctx,String actor,RuleNode args) {
        String kind=switch(op) {case "pickLiberal"->"persona_5_pick_liberal";case "swapCoalition"->"persona_7_swap_two_in_coalition";case "discardSolovei"->"persona_11_pick_opponent_persona";default->"persona_11_offer";};
        RuleNode pending=g.get("pending");
        if(!pending.get("kind").text().equals(kind)||!pending.get("playerId").text().equals(actor)||!ctx.get("currentPlayer").text().equals(actor))return false;
        if(op.equals("skipSolovei")){g.set("pending",null);return true;}
        RuleNode me=player(g,actor);
        if(op.equals("useSolovei")) {
            if(g.get("hasDrawn").truthy()||me.missing()||source(me,"persona_11")<0)return false;
            if(!targets(g,me,false)){g.set("pending",null);return false;}
            g.get("log").add(who(me)+" использует Соловья: добор пропущен.");
            g.set("pending",object("kind","persona_11_pick_opponent_persona","playerId",actor,"sourceCardId","persona_11"));return true;
        }
        RuleNode owner=player(g,args.at(0).text());
        String id=args.at(1).text();
        if(op.equals("swapCoalition")) {
            String second=args.at(2).text();
            if(id.isEmpty()||second.isEmpty()||id.equals(second))return false;
            if(owner.missing()||find(owner.get("coalition"),id)<0||find(owner.get("coalition"),second)<0) {
                RuleNode players=g.get("players");owner=players.at(-1);
                for(int i=0;i<players.size();i++)if(find(players.at(i).get("coalition"),id)>=0&&find(players.at(i).get("coalition"),second)>=0){owner=players.at(i);break;}
            }
            RuleNode cards=owner.get("coalition");int a=find(cards,id),b=find(cards,second);
            if(owner.missing()||a<0||b<0)return false;
            RuleNode ca=cards.at(a),cb=cards.at(b);
            if(!ca.get("type").text().equals("persona")||!cb.get("type").text().equals("persona"))return false;
            cards.set(Integer.toString(a),cb);cards.set(Integer.toString(b),ca);
            g.get("log").add((me.get("name").truthy()?who(me):actor)+" использовали способность Каспарова и поменяли местами "+title(ca)+" и "+title(cb)+" у "+owner.get("name").text()+".");
        } else {
            if(me.missing()||owner.missing()||owner.get("id").text().equals(actor))return false;
            int si=op.equals("pickLiberal")?find(me.get("coalition"),pending.get("sourceCardId").text()):source(me,"persona_11");
            int ti=find(owner.get("coalition"),id);if(si<0||ti<0)return false;
            RuleNode self=me.get("coalition").at(si),target=owner.get("coalition").at(ti);
            if(target.get("shielded").truthy())return false;
            if(op.equals("pickLiberal")) {
                if(!liberal(target))return false;
                owner.get("coalition").removeAt(ti);g.get("discard").add(target);
                double tokens=target.get("vpDelta").truthy()?target.get("vpDelta").number():0;
                if(tokens!=0&&!Double.isNaN(tokens)){scoring.tokens(g,self,tokens);target.set("vpDelta",0);target.set("plusTokens",0);target.set("minusTokens",0);}
                String label=self.get("name").truthy()?self.get("name").text():self.get("text").truthy()?self.get("text").text():"persona_5";
                g.get("log").add(who(me)+" ("+label+"): сбросил "+title(target)+" и украл "+JavaScoringRules.numeric(tokens)+" жетон(ов).");
            } else {
                if(!target.get("type").text().equals("persona"))return false;
                me.get("coalition").removeAt(si);g.get("discard").add(self);if(self.get("type").text().equals("persona"))scoring.personaDiscarded(g);
                owner.get("coalition").removeAt(ti);g.get("discard").add(target);scoring.personaDiscarded(g);
                g.get("log").add(who(me)+" (Соловей): сбросил себя и "+title(target)+" у "+owner.get("name").text()+".");
            }
        }
        g.set("pending",null);scoring.recalculate(g);return true;
    }
}
