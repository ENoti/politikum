package com.politikum.engine;

import static com.politikum.engine.GameState.object;

/** Native response windows, cancellation cards and persona 8/10 reactions. */
public final class JavaResponseRules {
    private static final long WINDOW_MS=15000;
    private final JavaAbilityRules.Scoring scoring;
    private final AbilityEffects effects;
    public JavaResponseRules(JavaAbilityRules.Scoring scoring,AbilityEffects effects){this.scoring=scoring;this.effects=effects;}
    private static int find(RuleNode cards,String id){for(int i=0;i<cards.size();i++)if(cards.at(i).get("id").text().equals(id))return i;return -1;}
    private static RuleNode player(RuleNode g,String id){return g.get("players").at(find(g.get("players"),id));}
    private static String base(RuleNode c){return c.get("id").text().split("#",2)[0];}
    private static String title(RuleNode c){return c.get("name").truthy()?c.get("name").text():c.get("id").text();}
    private static String who(RuleNode p){return p.get("name").text().equals("You")?"Вы":p.get("name").text();}
    private static boolean bot(RuleNode p){return p.get("isBot").truthy()||p.get("name").text().startsWith("[B]");}
    private static boolean kind(RuleNode n,String k){return n.get("kind").text().equals(k);}
    private static int baseIndex(RuleNode cards,String id,boolean persona){for(int i=0;i<cards.size();i++)if(base(cards.at(i)).equals(id)&&(!persona||cards.at(i).get("type").text().equals("persona")))return i;return -1;}
    private boolean expired(RuleNode g){return effects.responseExpired(g);}
    private static boolean targeted(RuleNode g){return kind(g.get("pending"),"action_4_discard")||kind(g.get("pending"),"action_9_discard_persona");}
    private void discardPersona(RuleNode g,RuleNode cards,int i){RuleNode c=cards.removeAt(i);g.get("discard").add(c);if(c.get("type").text().equals("persona"))scoring.personaDiscarded(g);}
    private void cancellationBonuses(RuleNode g){
        RuleNode players=g.get("players");for(int i=0;i<players.size();i++){RuleNode cards=players.at(i).get("coalition");for(int j=0;j<cards.size();j++){RuleNode c=cards.at(j);if(base(c).equals("persona_6"))scoring.tokens(g,c,1);if(base(c).equals("persona_29"))scoring.tokens(g,c,-1);}}
        scoring.recalculate(g);
    }
    public boolean cancelPending(RuleNode g,RuleNode ctx,String actor) {
        RuleNode pending=g.get("pending");if(!pending.truthy())return true;
        String owner=pending.get("playerId").truthy()?pending.get("playerId").text():pending.get("attackerId").truthy()?pending.get("attackerId").text():pending.get("targetId").text();
        if((!owner.isEmpty()&&!owner.equals(actor))||!ctx.get("currentPlayer").text().equals(actor))return false;
        String kind=pending.get("kind").text();
        if(!java.util.Set.of("persona_3_choice","persona_5_pick_liberal","persona_7_swap_two_in_coalition","persona_11_offer","persona_11_pick_opponent_persona","persona_13_pick_target","persona_16_discard3_from_hand","persona_17_pick_opponent","persona_17_pick_persona_from_hand","persona_20_pick_from_discard","persona_21_pick_target_invert","persona_23_choose_self_inflict_draw","persona_26_pick_red_nationalist","persona_28_pick_non_fbk","persona_32_pick_bounce_target","persona_33_choose_faction","persona_34_guess_topdeck","persona_37_pick_opponent_persona","persona_45_steal_from_opponent","action_7_block_persona","action_13_shield_persona","action_17_choose_opponent_persona","action_18_pick_persona_from_discard").contains(kind))return false;
        if(kind.equals("action_7_block_persona")) {
            RuleNode me=player(g,actor),last=g.get("lastAction");
            if(!me.missing()&&last.truthy()&&base(last).equals("action_7")) {
                RuleNode discard=g.get("discard");int i=find(discard,last.get("id").text());if(i>=0)me.get("hand").add(discard.removeAt(i));
                g.set("lastAction",null);g.set("hasPlayed",false);
            }
        }
        g.set("pending",null);try{scoring.recalculate(g);}catch(RuntimeException ignored){}return true;
    }
    public boolean swap(RuleNode g,String actor){
        RuleNode r=g.get("response"),spec=r.get("persona8Swap");
        if(!kind(r,"cancel_persona")||expired(g)||!spec.get("playerId").text().equals(actor))return false;
        RuleNode me=player(g,actor),owner=player(g,spec.get("ownerId").text());if(me.missing()||owner.missing())return false;
        RuleNode mine=me.get("coalition"),theirs=owner.get("coalition");int a=baseIndex(mine,"persona_8",false),b=find(theirs,spec.get("playedPersonaId").text());if(a<0||b<0)return false;
        RuleNode p8=mine.at(a),played=theirs.at(b);p8.set("_p8Used",true);
        if(!p8.get("type").text().equals("persona")||!played.get("type").text().equals("persona"))return false;
        mine.removeAt(a);theirs.set(Integer.toString(b),p8);mine.add(played);
        RuleNode players=g.get("players");for(int i=0;i<players.size();i++){RuleNode hand=players.at(i).get("hand");int j=find(hand,played.get("id").text());if(j>=0)hand.removeAt(j);}
        g.get("log").add(effects.actor(me,"persona_8")+" поменялся с "+title(played)+".");scoring.recalculate(g);g.set("response",null);return true;
    }
    public boolean cancel10(RuleNode g,String actor){
        RuleNode r=g.get("response");if(!kind(r,"cancel_action")||expired(g)||!r.get("allowPersona10By").text().equals(actor)||!targeted(g))return false;
        RuleNode me=player(g,actor);if(me.missing())return false;int i=baseIndex(me.get("coalition"),"persona_10",true);if(i<0)return false;
        RuleNode c=me.get("coalition").at(i);discardPersona(g,me.get("coalition"),i);g.set("pending",null);g.set("response",null);
        g.get("log").add(who(me)+" сбросил "+title(c)+", отменив эффект на своей коалиции.");scoring.recalculate(g);return true;
    }
    public boolean handles(RuleNode g,RuleNode card,RuleNode ctx,String actor){return !ctx.get("currentPlayer").text().equals(actor)||(base(card).equals("action_8")&&kind(g.get("response"),"cancel_persona")&&!g.get("response").get("playedBy").text().equals(actor));}
    public boolean action(RuleNode g,RuleNode me,RuleNode card,RuleNode ctx,String actor){
        if(card.missing())return false;RuleNode r=g.get("response");String bid=base(card);int idx=find(me.get("hand"),card.get("id").text());if(idx<0)return false;
        if(bid.equals("action_8")&&kind(r,"cancel_persona")&&!r.get("playedBy").text().equals(actor)){
            double exp=r.get("expiresAtMs").number();if(exp!=0&&effects.now()>exp+2000)return false;
            RuleNode played=r.get("personaCard");if(base(played).equals("persona_33"))return false;
            if(kind(g.get("pending"),"resolve_persona_after_response")&&g.get("pending").get("personaId").text().equals(played.get("id").text()))g.set("pending",null);
            me.get("hand").removeAt(idx);g.get("discard").add(card);g.set("lastAction",card);
            RuleNode players=g.get("players");for(int i=0;i<players.size();i++){RuleNode cards=players.at(i).get("coalition");int j=find(cards,played.get("id").text());if(j>=0){discardPersona(g,cards,j);break;}}
            cancellationBonuses(g);String name=played.get("name").truthy()?played.get("name").text():played.get("text").truthy()?played.get("text").text():played.get("id").truthy()?played.get("id").text():"персонажа";
            g.get("log").add(me.get("name").text()+" обвинил "+name+" в работе на кремль!");g.set("response",null);return true;
        }
        if(ctx.get("currentPlayer").text().equals(actor)||!card.get("type").text().equals("action")||!kind(r,"cancel_action")||expired(g))return false;
        if(bid.equals("action_6")){
            if(r.get("playedBy").text().equals(actor))return false;
            me.get("hand").removeAt(idx);g.get("discard").add(card);g.set("lastAction",card);g.get("discard").add(r.get("actionCard"));g.set("pending",null);
            g.get("log").add(who(me)+" ОТМЕНИЛ действие "+r.get("actionCard").get("id").text()+" (в сброс).");
        }else if(bid.equals("action_14")&&targeted(g)&&g.get("pending").get("targetId").text().equals(actor)){
            me.get("hand").removeAt(idx);g.get("discard").add(card);g.set("lastAction",card);if(r.get("actionCard").truthy())g.get("discard").add(r.get("actionCard"));g.set("pending",null);
            g.get("log").add(who(me)+" отменил эффект действия \""+effects.actionTitle(r.get("actionCard"))+"\" на своей коалиции используя \""+effects.actionTitle(card)+"\".");
        }else return false;
        g.set("response",null);return true;
    }
    public void openAction(RuleNode g,RuleNode target,RuleNode card,String actor,boolean allow10){
        g.set("response",object("kind","cancel_action","playedBy",actor,"expiresAtMs",effects.now()+WINDOW_MS));RuleNode r=g.get("response");r.set("actionCard",card);
        if(allow10)r.set("allowPersona10By",baseIndex(target.get("coalition"),"persona_10",false)>=0?target.get("id").text():null);
    }
    private static boolean action8(RuleNode player){RuleNode hand=player.get("hand");for(int i=0;i<hand.size();i++)if(hand.at(i).get("type").text().equals("action")&&base(hand.at(i)).equals("action_8"))return true;return false;}
    public void openBotPersona(RuleNode g,RuleNode card,String actor){
        boolean human=false;RuleNode players=g.get("players");for(int i=0;i<players.size();i++){RuleNode p=players.at(i);if(p.get("active").truthy()&&!p.get("id").text().equals(actor)&&!bot(p)&&action8(p))human=true;}
        if(human){g.set("response",object("kind","cancel_persona","playedBy",actor,"expiresAtMs",effects.now()+WINDOW_MS));g.get("response").set("personaCard",card);g.set("botPauseUntilMs",effects.now()+WINDOW_MS);}
        else{g.set("response",null);g.set("botPauseUntilMs",0);}
    }
    public void playedPersona(RuleNode g,RuleNode owner,RuleNode card,String actor){
        RuleNode players=g.get("players"),botResponder=players.at(-1),swap=players.at(-1);boolean human=false;
        for(int i=0;i<players.size();i++){
            RuleNode p=players.at(i);if(p.get("id").text().equals(actor))continue;
            if(swap.missing()&&!p.get("id").text().equals(owner.get("id").text())){
                RuleNode cards=p.get("coalition");for(int j=0;j<cards.size();j++)if(base(cards.at(j)).equals("persona_8")&&!cards.at(j).get("_p8Used").truthy()){swap=p;break;}
            }
            if(!p.get("active").truthy()||!action8(p))continue;
            if(bot(p)){if(botResponder.missing())botResponder=p;}else human=true;
        }
        // Preserve the legacy check against the played card owner, not the swap actor.
        boolean humanSwap=!swap.missing()&&owner.get("active").truthy()&&!bot(owner);
        if(human||humanSwap){
            g.set("response",object("kind","cancel_persona","playedBy",actor,"expiresAtMs",effects.now()+WINDOW_MS,"persona8Swap",swap.missing()?null:object("playerId",swap.get("id").text(),"ownerId",owner.get("id").text(),"playedPersonaId",card.get("id").text())));
            g.get("response").set("personaCard",card);g.set("botPauseUntilMs",effects.now()+WINDOW_MS);
            g.set("pending",object("kind","resolve_persona_after_response","playerId",actor,"sourceCardId",card.get("id").text(),"personaId",card.get("id").text()));
            if(!card.get("abilityKey").missing())g.get("pending").set("abilityKey",card.get("abilityKey"));
        }else if(!botResponder.missing()&&!base(card).equals("persona_33")){
            g.set("response",null);RuleNode hand=botResponder.get("hand");int i=-1;for(int j=0;j<hand.size();j++)if(hand.at(j).get("type").text().equals("action")&&base(hand.at(j)).equals("action_8")){i=j;break;}
            if(i>=0){RuleNode response=hand.removeAt(i);g.get("discard").add(response);g.set("lastAction",response);}
            int drop=find(owner.get("coalition"),card.get("id").text());if(drop>=0)discardPersona(g,owner.get("coalition"),drop);
            cancellationBonuses(g);g.set("pending",null);g.get("log").add(botResponder.get("name").text()+" обвинил "+title(card)+" в работе на кремль!");
        }else{
            g.set("response",null);try{effects.run(g,owner,card);effects.adjacent(g,owner,card);}catch(RuntimeException ignored){}
        }
    }
}
