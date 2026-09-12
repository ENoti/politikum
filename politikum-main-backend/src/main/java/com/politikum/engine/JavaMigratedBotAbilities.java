package com.politikum.engine;

import java.util.*;
import static com.politikum.engine.GameState.object;

/** Legacy bot choices for the migrated coalition and hand abilities. */
public final class JavaMigratedBotAbilities {
    private final JavaAbilityRules.Scoring scoring;
    private final AbilityEffects effects;
    public JavaMigratedBotAbilities(JavaAbilityRules.Scoring scoring,AbilityEffects effects){this.scoring=scoring;this.effects=effects;}
    private static int find(RuleNode cards,String id){for(int i=0;i<cards.size();i++)if(cards.at(i).get("id").text().equals(id))return i;return -1;}
    private static String base(RuleNode c){return c.get("id").text().split("#",2)[0];}
    private static boolean persona(RuleNode c){return c.get("type").text().equals("persona");}
    private static String title(RuleNode c){return c.get("name").truthy()?c.get("name").text():c.get("id").text();}
    private static String who(RuleNode p){return p.get("name").text().equals("You")?"Вы":p.get("name").text();}
    private static int personas(RuleNode cards){int n=0;for(int i=0;i<cards.size();i++)if(persona(cards.at(i)))n++;return n;}
    private static boolean liberal(RuleNode c){RuleNode tags=c.get("tags");for(int i=0;i<tags.size();i++)if(tags.at(i).text().equals("faction:liberal"))return true;return false;}
    public boolean choose(RuleNode g,RuleNode me,RuleNode ctx,RuleNode queue){
        RuleNode pending=g.get("pending"),players=g.get("players");String kind=pending.get("kind").text(),actor=me.get("id").text();
        if(!pending.get("playerId").text().equals(actor))return false;
        String prefix=who(me)+" ("+pending.get("sourceCardId").text()+")";
        if(kind.equals("persona_11_offer")){g.set("pending",null);g.set("botNextActAtMs",effects.now()+250);return true;}
        if(kind.equals("persona_17_pick_opponent")){
            RuleNode best=players.at(-1);int bestCount=-1;
            for(int i=0;i<players.size();i++){RuleNode p=players.at(i);if(p.get("id").text().equals(actor))continue;int count=personas(p.get("hand"));if(count>bestCount){best=p;bestCount=count;}}
            if(best.missing()||bestCount<=0)g.set("pending",null);
            else g.set("pending",object("kind","persona_17_pick_persona_from_hand","playerId",actor,"sourceCardId",pending.get("sourceCardId").truthy()?pending.get("sourceCardId").text():"persona_17","targetId",best.get("id").text()));
            g.set("botNextActAtMs",effects.now()+250);return true;
        }
        if(kind.equals("persona_17_pick_persona_from_hand")){
            RuleNode target=players.at(find(players,pending.get("targetId").text()));int idx=-1;
            for(int i=0;i<target.get("hand").size();i++)if(persona(target.get("hand").at(i))){idx=i;break;}
            if(target.missing()||idx<0){g.set("pending",null);g.set("botNextActAtMs",effects.now()+250);return true;}
            RuleNode c=target.get("hand").removeAt(idx);me.get("hand").add(c);g.get("log").add(who(me)+" (Арно) забрал "+title(c)+" из руки "+target.get("name").text()+".");
            g.set("pending",null);scoring.recalculate(g);g.set("botNextActAtMs",effects.now()+600);return true;
        }
        boolean finish=false;
        if(kind.equals("persona_5_pick_liberal")){
            RuleNode self=me.get("coalition").at(find(me.get("coalition"),pending.get("sourceCardId").text()));boolean picked=false;
            outer:for(int i=0;i<players.size();i++){
                RuleNode owner=players.at(i);if(owner.get("id").text().equals(actor))continue;
                RuleNode cards=owner.get("coalition");for(int j=0;j<cards.size();j++){
                    RuleNode c=cards.at(j);if(!persona(c)||base(c).equals("persona_31")||c.get("shielded").truthy()||!liberal(c))continue;
                    cards.removeAt(j);g.get("discard").add(c);double tokens=c.get("vpDelta").number();if(tokens!=0&&!Double.isNaN(tokens)&&!self.missing())scoring.tokens(g,self,tokens);
                    g.get("log").add(prefix+": сбросил "+title(c)+" и украл "+JavaScoringRules.numeric(tokens)+" жетон(ов).");picked=true;break outer;
                }
            }
            if(!picked)g.get("log").add(prefix+": нет либерала для сброса.");finish=true;
        }else if(kind.equals("persona_7_swap_two_in_coalition")){
            RuleNode cards=me.get("coalition");int a=-1,b=-1;for(int i=0;i<cards.size();i++)if(persona(cards.at(i))){if(a<0)a=i;else{b=i;break;}}
            if(b>=0){RuleNode ca=cards.at(a),cb=cards.at(b);cards.set(Integer.toString(a),cb);cards.set(Integer.toString(b),ca);g.get("log").add(prefix+" поменял местами двух персонажей в своей коалиции.");}
            else g.get("log").add(prefix+": некого менять местами (автоскип).");finish=true;
        }else if(kind.equals("persona_45_steal_from_opponent")){
            List<RuleNode> opponents=new ArrayList<>();for(int i=0;i<players.size();i++)if(!players.at(i).get("id").text().equals(actor))opponents.add(players.at(i));
            opponents.sort(Comparator.<RuleNode>comparingDouble(effects::score).reversed().thenComparing(Comparator.<RuleNode>comparingInt(p->personas(p.get("coalition"))).reversed()).thenComparing(Comparator.<RuleNode>comparingInt(p->p.get("hand").size()).reversed()));
            RuleNode target=opponents.isEmpty()?players.at(-1):opponents.get(0);String last=me.get("botLastOffTargetId").text();for(RuleNode p:opponents)if(!p.get("id").text().equals(last)){target=p;break;}
            if(!target.missing())me.set("botLastOffTargetId",target.get("id").text());
            if(target.get("hand").size()>0){RuleNode c=target.get("hand").removeAt((int)Math.floor(effects.random()*target.get("hand").size()));if(c.truthy()){me.get("hand").add(c);g.get("log").add(me.get("name").text()+" забрал 1 карту у "+target.get("name").text()+".");}}
            else g.get("log").add(prefix+" хотел украсть карту, но подходящей руки соперника не нашлось.");
        }else return false;
        g.set("pending",null);scoring.recalculate(g);
        if(finish&&!g.get("response").truthy()&&g.get("hasDrawn").truthy()&&g.get("hasPlayed").truthy()){
            if(!effects.endRound(g,ctx))queue.add(object("type","endTurn","payload",null));return true;
        }
        g.set("botNextActAtMs",effects.now()+400);return true;
    }
}
