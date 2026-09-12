package com.politikum.engine;

import org.graalvm.polyglot.*;
import org.graalvm.polyglot.proxy.ProxyExecutable;

/** Compatibility adapter; token arithmetic remains owned by JavaScoringRules. */
public final class GraalAbilityBridge {
    private GraalAbilityBridge() {}
    public static void install(Context context) {
        Value parse = context.eval("js", "JSON.parse");
        JavaAbilityRules rules = new JavaAbilityRules(new JavaAbilityRules.Scoring() {
            private Value value(RuleNode n) { return ((GraalRuleNode)n).value(); }
            public void simple(RuleNode card, double delta) { context.getBindings("js").getMember("applyTokenDelta").execute(value(card), delta); }
            public void tokens(RuleNode g, RuleNode card, double delta) { context.getBindings("js").getMember("applyTokenDelta2").execute(value(g), value(card), delta); }
            public void recalculate(RuleNode g) { context.getBindings("js").getMember("recalcPassives").execute(value(g)); }
            public void personaDiscarded(RuleNode g) { context.getBindings("js").getMember("persona44OnPersonaDiscarded").execute(value(g)); }
        }, new JavaAbilityRules.Titles() {
            public String action(RuleNode card) {
                return context.getBindings("js").getMember("actionTitle").execute(((GraalRuleNode) card).value()).asString();
            }
            public String persona(String baseId) {
                return context.getBindings("js").getMember("personaTitleByBaseId").execute(baseId).asString();
            }
        });
        context.getBindings("js").putMember("__politikumNativeAbility", (ProxyExecutable) args ->
            rules.invoke(args[0].asString(), new GraalRuleNode(args[1],parse), new GraalRuleNode(args[2],parse),
                new GraalRuleNode(args[3],parse), new GraalRuleNode(args[4],parse), args[5].asString(), args[6].asString()));
    }
}
