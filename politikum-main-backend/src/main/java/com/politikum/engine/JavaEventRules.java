package com.politikum.engine;

import java.util.*;
import static com.politikum.engine.GameState.object;

/** Event effects and multiplayer selections, independent of the guest representation. */
public final class JavaEventRules {
    private final JavaAbilityRules.Scoring scoring;
    private final AbilityEffects effects;
    public JavaEventRules(JavaAbilityRules.Scoring scoring, AbilityEffects effects) {
        this.scoring=scoring;this.effects=effects;
    }
    private static String base(String id) { return id.split("#",2)[0]; }
    private static String base(RuleNode c) { return base(c.get("id").text()); }
    private static String who(RuleNode p) { return p.get("name").text().equals("You")?"Вы":p.get("name").text(); }
    private static String drew(RuleNode p) { String n=p.get("name").text();return n.endsWith("а")||n.endsWith("я")?"вытянула":"вытянул"; }
    private static String title(RuleNode c) { return c.get("name").truthy()?c.get("name").text():c.get("id").text(); }
    private static boolean persona(RuleNode c) { return c.get("type").text().equals("persona"); }
    private static boolean tagged(RuleNode c,String tag) {
        RuleNode tags=c.get("tags");for(int i=0;i<tags.size();i++)if(tags.at(i).text().equals(tag))return true;return false;
    }
    private static int find(RuleNode cards,String id) { for(int i=0;i<cards.size();i++)if(cards.at(i).get("id").text().equals(id))return i;return -1; }
    private static RuleNode player(RuleNode g,String id) { return g.get("players").at(find(g.get("players"),id)); }
    private static boolean tokenEvent(String id) { return Set.of("event_1","event_2","event_3","event_10").contains(id); }
    private void doubleDrawLog(RuleNode g,RuleNode me,boolean event) {
        g.get("log").add(me.get("name").text()+(event?" попался тайный удвоитель!":" берёт карту в результате тайного удвоителя"));
    }
    public void draw(RuleNode g,RuleNode me,String source,double count) {
        for(int i=0;i<Math.max(0,count)&&g.get("deck").size()>0;i++)drawOne(g,me,source);
    }
    private void drawOne(RuleNode g,RuleNode me,String source) {
        RuleNode c=g.get("deck").removeAt(0);if(!c.truthy())return;
        String src=base(source);
        if(c.get("type").text().equals("event")) {
            g.set("lastEvent",c);
            if(src.equals("event_15"))g.get("log").add("Вам выпал ЧЕРНЫЙ ЛЕБЕДЬ");
            else if(src.equals("event_10"))g.get("log").add(me.get("name").text()+" попался \"Перевод в криптоколонию\"");
            else if(src.equals("event_11"))doubleDrawLog(g,me,true);
            else if(!(me.get("name").text().startsWith("[B]")&&tokenEvent(base(c))))g.get("log").add(who(me)+" вытянул "+effects.eventTitle(c));
            effects.run(g,me,c);g.get("discard").add(c);return;
        }
        me.get("hand").add(c);
        if(src.equals("event_12a"))g.get("log").add("Вы взяли одну карту после набега единорогов");
        else if(src.equals("event_12c"))g.get("log").add(who(me)+" взял карту из-за срача в твиттере.");
        else if(src.equals("event_11"))doubleDrawLog(g,me,false);
        else g.get("log").add(who(me)+" взял карту из "+(source.isEmpty()?"ability":source)+".");
    }
    public void enter(String operation,RuleNode g,RuleNode me,RuleNode card) {
        switch(operation) {
            case "draw_1" -> draw(g,me,card.get("id").truthy()?card.get("id").text():"draw_1",1);
            case "event_draw_cards" -> draw(g,me,card.get("id").truthy()?card.get("id").text():"event_draw_cards",card.get("params").get("count").missing()?1:card.get("params").get("count").number());
            case "event_faction_minus1_draw1" -> faction(g,me,card);
            case "event_12b_discard_others_hand" -> offerHandDiscard(g,me,card);
            case "event_shuffle_all_hands_redeal" -> redeal(g,me,card);
            case "event_16_discard_self_persona_then_draw1" -> offerCoalitionDiscard(g,me,card);
            default -> throw new IllegalArgumentException(operation);
        }
    }
    private void faction(RuleNode g,RuleNode me,RuleNode card) {
        String tag=card.get("params").get("factionTag").text();if(tag.isEmpty())return;
        int affected=0;RuleNode players=g.get("players");
        for(int i=0;i<players.size();i++) {
            RuleNode cards=players.at(i).get("coalition");
            for(int j=0;j<cards.size();j++)if(persona(cards.at(j))&&tagged(cards.at(j),tag)){scoring.simple(cards.at(j),-1);affected++;}
        }
        String bid=base(card),label=bid.equals("event_12a")?"Набег единорогов":bid.equals("event_12c")?"Срач в твиттере - русский флаг":"EVENT "+card.get("id").text();
        String word=tag.equals("faction:liberal")?"либерала":tag.equals("faction:fbk")?"ФБК":tag;
        if(affected>0)g.get("log").add(label+": "+affected+" персонаж(ей) "+word+" получает -1, затем вы берёте карту.");
        else if(bid.equals("event_12a"))g.get("log").add("Вам выпал набег единорогов, но в игре нет никого из ФБК, тем ни менее 1 карта ваша.");
        else g.get("log").add(label+": нет персонажей "+word+", но карту всё равно берёте.");
        draw(g,me,card.get("id").truthy()?card.get("id").text():"event_faction_minus1_draw1",1);
    }
    private void offerHandDiscard(RuleNode g,RuleNode me,RuleNode card) {
        String label=base(card).equals("event_12b")?"Секс скандал":effects.eventTitle(card);
        List<String> targets=new ArrayList<>();RuleNode players=g.get("players");
        for(int i=0;i<players.size();i++) {
            RuleNode p=players.at(i),hand=p.get("hand");
            if(p.get("id").text().equals(me.get("id").text())||!p.get("active").truthy()||hand.size()==0)continue;
            if(p.get("name").text().startsWith("[B]")) {
                // Legacy bot path removes the card without adding it to discard.
                hand.removeAt(0);g.get("log").add(label+": "+p.get("name").text()+" сбросил 1 карту с руки.");
            } else targets.add(p.get("id").text());
        }
        if(!targets.isEmpty()) {
            g.set("pending",object("kind","event_12b_discard_from_hand","playerId",me.get("id").text(),"sourceCardId",card.get("id").text(),"targetIds",targets));
            g.get("log").add(label+": остальные игроки должны сбросить 1 карту.");
        }
    }
    private void redeal(RuleNode g,RuleNode me,RuleNode card) {
        List<RuleNode> pool=new ArrayList<>();Map<String,Integer> counts=new HashMap<>();RuleNode players=g.get("players");
        for(int i=0;i<players.size();i++) {
            RuleNode p=players.at(i),hand=p.get("hand");counts.put(p.get("id").text(),hand.size());
            while(hand.size()>0)pool.add(hand.removeAt(0));
        }
        for(int i=pool.size()-1;i>0;i--)Collections.swap(pool,i,(int)Math.floor(effects.random()*(i+1)));
        int at=0;
        for(int i=0;i<players.size();i++) {
            RuleNode p=players.at(i);int need=counts.getOrDefault(p.get("id").text(),0);p.set("hand",List.of());
            for(int j=0;j<need&&at<pool.size();j++) { RuleNode c=pool.get(at++);if(c.truthy())p.get("hand").add(c); }
        }
        g.get("log").add(base(card).equals("event_15")?who(me)+" вытянул Черный лебедь, все карты из рук перемешались и раздались обратно":who(me)+" EVENT "+card.get("id").text()+": все руки перемешались и раздали заново.");
    }
    private void offerCoalitionDiscard(RuleNode g,RuleNode me,RuleNode card) {
        boolean can=false;RuleNode cards=me.get("coalition");for(int i=0;i<cards.size();i++)if(discardable(cards.at(i)))can=true;
        String name=card.get("text").truthy()?card.get("text").text():title(card);
        if(!can) {
            g.get("log").add(base(card).equals("event_16")?"Политический [РОСКОМНАДЗОР] ушел в отбой никого не сбросив.":who(me)+" "+name+": нечего сбрасывать (все персоны защищены/неподвижны).");return;
        }
        g.set("pending",object("kind","event_16_discard_self_persona_then_draw1","playerId",me.get("id").text(),"sourceCardId",card.get("id").text()));
        if(!base(card).equals("event_16"))g.get("log").add(who(me)+" EVENT "+name+": сбросьте 1 персону из коалиции, затем возьмите 1 карту.");
    }
    private static boolean discardable(RuleNode card) { return persona(card)&&!base(card).equals("persona_31")&&!card.get("shielded").truthy(); }
    public boolean discardHand(RuleNode g,String actor,String id) {
        RuleNode pending=g.get("pending"),targets=pending.get("targetIds");
        if(!pending.get("kind").text().equals("event_12b_discard_from_hand"))return false;
        boolean allowed=false;List<String> left=new ArrayList<>();
        for(int i=0;i<targets.size();i++)if(targets.at(i).text().equals(actor))allowed=true;else left.add(targets.at(i).text());
        RuleNode me=player(g,actor);int idx=find(me.get("hand"),id);if(!allowed||me.missing()||idx<0)return false;
        RuleNode c=me.get("hand").removeAt(idx);g.get("discard").add(c);if(persona(c))scoring.personaDiscarded(g);
        String source=pending.get("sourceCardId").text(),label;
        if(base(source).equals("event_12b"))label="Секс скандал";
        else { String ev=effects.cardTitle(source);label=ev.substring(ev.lastIndexOf(':')+1).trim();if(label.isEmpty())label=ev.isEmpty()?source:ev; }
        g.get("log").add(label+":: "+who(me)+" сбросил 1 карту с руки.");pending.set("targetIds",left);
        if(left.isEmpty()) { g.set("pending",null);try{effects.expire(g);}catch(RuntimeException ignored){} }
        return true;
    }
    public boolean discardCoalition(RuleNode g,String actor,String id) {
        RuleNode pending=g.get("pending"),me=player(g,actor);
        if(!pending.get("kind").text().equals("event_16_discard_self_persona_then_draw1")||!pending.get("playerId").text().equals(actor)||me.missing())return false;
        RuleNode cards=me.get("coalition");int idx=find(cards,id);if(idx<0||!discardable(cards.at(idx)))return false;
        RuleNode c=cards.removeAt(idx);g.get("discard").add(c);scoring.personaDiscarded(g);
        String source=pending.get("sourceCardId").text();
        g.get("log").add(who(me)+" сбросил "+title(c)+" из своей коалиции из-за "+(base(source).equals("event_16")?"события политический [РОСКОМНАДЗОР]":"\""+effects.cardTitle(source)+"\"")+".");
        drawAfterDiscard(g,me,source,false);g.set("pending",null);return true;
    }
    private void drawAfterDiscard(RuleNode g,RuleNode me,String source,boolean bot) {
        if(g.get("deck").size()==0)return;RuleNode next=g.get("deck").removeAt(0);if(!next.truthy())return;
        if(next.get("type").text().equals("event")) {
            g.set("lastEvent",next);String prefix=who(me)+" "+drew(me)+" "+effects.eventMoveTitle(next);
            g.get("log").add(!bot&&base(source).equals("event_16")&&base(next).equals("event_10")?prefix+", после политический [РОСКОМНАДЗОР].":prefix+" (из \""+effects.cardTitle(source)+"\")");
            effects.run(g,me,next);effects.eventPlayed(g,next);g.get("discard").add(next);
        } else {
            me.get("hand").add(next);g.get("log").add(base(source).equals("event_16")?"Зато взяли карту.":who(me)+" взял карту из \""+effects.cardTitle(source)+"\".");
        }
    }
    public boolean botDiscard(RuleNode g,RuleNode me) {
        RuleNode pending=g.get("pending");
        if(!pending.get("kind").text().equals("event_16_discard_self_persona_then_draw1")||!pending.get("playerId").text().equals(me.get("id").text()))return false;
        RuleNode cards=me.get("coalition");for(int i=0;i<cards.size();i++)if(discardable(cards.at(i))) { g.get("discard").add(cards.removeAt(i));break; }
        drawAfterDiscard(g,me,pending.get("sourceCardId").text(),true);g.set("pending",null);scoring.recalculate(g);g.set("botNextActAtMs",effects.now()+600);return true;
    }
    public void drawnEvent(RuleNode g,RuleNode me,RuleNode card,boolean legacy) {
        String bid=base(card),prefix=who(me)+" "+drew(me)+" ",name=effects.eventMoveTitle(card);
        if(legacy) {
            g.set("lastEvent",card);
            if(bid.equals("event_10"))g.get("log").add(me.get("name").text()+" попался \"Перевод в криптоколонию\"");
            else if(bid.equals("event_11"))doubleDrawLog(g,me,true);
            else if(bid.equals("event_15"))g.get("log").add(who(me)+": вам выпал ЧЕРНЫЙ ЛЕБЕДЬ");
            else g.get("log").add(prefix+name);
        } else if(!tokenEvent(bid)&&!bid.equals("event_15")) {
            g.get("log").add(bid.equals("event_12b")?prefix+"Срач в Твиттере: Секс скандал!":bid.equals("event_12c")?prefix+"\""+name+"\"":prefix+name);
        }
        if(tagged(card,"event_type:twitter_squabble")) {
            RuleNode players=g.get("players");for(int i=0;i<players.size();i++) { RuleNode cards=players.at(i).get("coalition");for(int j=0;j<cards.size();j++)if(base(cards.at(j)).equals("persona_4"))scoring.tokens(g,cards.at(j),-2); }
        }
        effects.run(g,me,card);effects.eventPlayed(g,card);
        if(legacy) { scoring.recalculate(g);g.get("discard").add(card); }
    }
    public void queuedEvent(RuleNode g,RuleNode queue,RuleNode card) {
        RuleNode me=player(g,queue.get("playerId").text());
        g.get("log").add(who(me)+" вытянул Событие \""+effects.eventMoveTitle(card)+"\" из способности "+queue.get("sourceCardId").text()+".");
        effects.run(g,me,card);
    }
}
