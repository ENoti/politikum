package com.politikum.engine;

import java.util.*;
import static com.politikum.engine.GameState.object;

/** Draw/selection orchestration for personas 16, 17 and 45. */
public final class JavaHandAbilityRules {
    private final JavaAbilityRules.Scoring scoring;
    private final AbilityEffects effects;
    public JavaHandAbilityRules(JavaAbilityRules.Scoring scoring,AbilityEffects effects){this.scoring=scoring;this.effects=effects;}
    private static int find(RuleNode cards,String id){for(int i=0;i<cards.size();i++)if(cards.at(i).get("id").text().equals(id))return i;return -1;}
    private static RuleNode player(RuleNode g,String id){return g.get("players").at(find(g.get("players"),id));}
    private static String who(RuleNode p){return p.get("name").text().equals("You")?"Вы":p.get("name").text();}
    private static String title(RuleNode c){return c.get("name").truthy()?c.get("name").text():c.get("id").text();}
    public void enter(int n,RuleNode g,RuleNode me,RuleNode card){
        String id=me.get("id").text(),source=card.get("id").text();
        if(n==16){
            // Keep the queue in guest state so nested event effects share card identities.
            g.set("persona16AfterEvents",object("playerId",id,"sourceCardId",source,"events",List.of()));
            RuleNode queue=g.get("persona16AfterEvents").get("events"),deck=g.get("deck");
            for(int i=0;i<3&&deck.size()>0;i++){
                RuleNode next=deck.removeAt(0);if(!next.truthy())break;
                if(next.get("type").text().equals("event"))queue.add(next);else me.get("hand").add(next);
            }
            if(queue.size()>0){
                RuleNode next=queue.removeAt(0);JavaEventRules.markLastEvent(g,me,next);
                String name=(card.get("text").truthy()?card.get("text").text():title(card)).trim();
                g.get("log").add(who(me)+" вытянул Событие \""+effects.eventTitle(next)+"\" из способности "+name+".");
                effects.run(g,me,next);g.get("discard").add(next);
            }else g.set("pending",object("kind","persona_16_discard3_from_hand","playerId",id,"sourceCardId",source));
            g.get("log").add(effects.actor(me,"persona_16")+": возьмите 3 карты, затем сбросьте 3 карты с руки.");
        }else{
            g.set("pending",object("kind",n==17?"persona_17_pick_opponent":"persona_45_steal_from_opponent","playerId",id,"sourceCardId",source));
            if(n==17)g.get("log").add(who(me)+" ("+title(card)+"): выберите соперника — посмотрите его руку и заберите 1 персону.");
            if(n==45)g.get("log").add(me.get("name").text()+" ("+title(card)+") способность: забирает случайную карту из руки оппонента");
        }
    }
    public boolean choose(String op,RuleNode g,RuleNode ctx,String actor,RuleNode args,RuleNode events){
        RuleNode pend=g.get("pending");
        String kind=switch(op){case "discard16"->"persona_16_discard3_from_hand";case "pick17"->"persona_17_pick_opponent";case "steal17"->"persona_17_pick_persona_from_hand";default->"persona_45_steal_from_opponent";};
        if(!pend.get("kind").text().equals(kind)||!pend.get("playerId").text().equals(actor))return false;
        if((op.equals("pick17")||op.equals("steal17"))&&!ctx.get("currentPlayer").text().equals(actor))return false;
        RuleNode me=player(g,actor);
        if(op.equals("discard16")){
            List<String> chosen=new ArrayList<>();LinkedHashSet<String> unique=new LinkedHashSet<>();
            for(int i=0;i<3;i++){
                RuleNode arg=args.at(i);if(arg.truthy())chosen.add(arg.text());
                String id=arg.text();if(!id.isEmpty()&&!id.equals("undefined")&&!id.equals("null"))unique.add(id);
            }
            Collections.sort(chosen);String joined=String.join(",",chosen),signature=pend.get("sourceCardId").text()+":"+joined;
            if(!joined.isEmpty()&&g.get("_lastPersona16ResolveSignature").text().equals(signature)){
                g.set("pending",null);g.set("_lastPersona16ResolveSignature","");return true;
            }
            g.set("_lastPersona16ResolveSignature",signature);if(me.missing())return false;
            RuleNode hand=me.get("hand");int required=Math.max(0,hand.size()-6);
            List<String> drops=new ArrayList<>(unique);drops=drops.subList(0,Math.min(drops.size(),Math.min(required,hand.size())));
            if(required>0&&drops.size()!=required)return false;
            // Preserve legacy treatment of nonexistent ids: they count toward the selection.
            for(String id:drops){int i=find(hand,id);if(i<0)continue;RuleNode c=hand.removeAt(i);g.get("discard").add(c);if(c.get("type").text().equals("persona"))scoring.personaDiscarded(g);}
            g.set("pending",null);try{effects.expire(g);}catch(RuntimeException ignored){}
            scoring.recalculate(g);g.get("log").add(who(me)+" сбросил "+drops.size()+" карт(ы), чтобы после добора в руке было не больше 7.");
            g.set("_lastPersona16ResolveSignature","");return true;
        }
        RuleNode target=player(g,op.equals("steal17")?pend.get("targetId").text():args.at(0).text());
        if(target.missing())return false;
        if(op.equals("pick17")){
            if(args.at(0).text().isEmpty()||target.get("id").text().equals(actor))return false;
            int count=0;for(int i=0;i<target.get("hand").size();i++)if(target.get("hand").at(i).get("type").text().equals("persona"))count++;
            if(count==0){
                g.get("log").add(who(me)+" (Арно): у "+target.get("name").text()+" нет персон в руке (пропуск).");g.set("pending",null);scoring.recalculate(g);
                if(g.get("hasDrawn").truthy()&&g.get("hasPlayed").truthy()&&!g.get("response").truthy()&&!effects.endRound(g,ctx))events.add(object("type","endTurn","payload",null));
            }else g.set("pending",object("kind","persona_17_pick_persona_from_hand","playerId",actor,"sourceCardId",pend.get("sourceCardId").truthy()?pend.get("sourceCardId").text():"persona_17","targetId",target.get("id").text()));
            return true;
        }
        if(me.missing())return false;
        RuleNode hand=target.get("hand");
        if(op.equals("steal17")){
            int i=find(hand,args.at(0).text());if(i<0||!hand.at(i).get("type").text().equals("persona"))return false;
            RuleNode c=hand.removeAt(i);me.get("hand").add(c);g.get("log").add(who(me)+" (Арно) забрал "+title(c)+" из руки "+target.get("name").text()+".");
            g.set("pending",null);scoring.recalculate(g);return true;
        }
        if(target.get("id").text().equals(actor))return false;
        // An empty hand is a rejected selection, instead of the legacy ReferenceError.
        if(hand.size()==0)return false;
        RuleNode c=hand.removeAt((int)Math.floor(effects.random()*hand.size()));
        if(c.truthy()){me.get("hand").add(c);g.get("log").add("Вы с Шульман забрали 1 карту у "+target.get("name").text()+".");}
        g.set("pending",null);return true;
    }
}
