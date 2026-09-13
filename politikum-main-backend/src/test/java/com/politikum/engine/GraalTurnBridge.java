package com.politikum.engine;

import org.graalvm.polyglot.Context;
import org.graalvm.polyglot.Value;
import org.graalvm.polyglot.proxy.ProxyExecutable;
import org.springframework.core.io.ClassPathResource;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.Arrays;

/** Narrow guest/native adapter: no general Java host access is enabled. */
public final class GraalTurnBridge {
    private GraalTurnBridge() {}
    public static void install(Context context, Clock clock) throws IOException {
        GraalAbilityBridge.install(context);
        Value parse = context.eval("js", "JSON.parse");
        TurnEffects effects = new TurnEffects() {
            private void call(String name, RuleNode... nodes) {
                Object[] values = Arrays.stream(nodes).map(n -> ((GraalRuleNode) n).value()).toArray();
                context.getBindings("js").getMember(name).execute(values);
            }
            @Override public void drawnEvent(RuleNode g, RuleNode p, RuleNode c) { call("turnDrawnEvent", g, p, c); }
            @Override public void deferredPersona(RuleNode g, RuleNode pending) { call("turnDeferredPersona", g, pending); }
            @Override public void queuedEvent(RuleNode g, RuleNode queue, RuleNode c) { call("turnQueuedEvent", g, queue, c); }
            @Override public void recalculate(RuleNode g) { call("recalcPassives", g); }
            @Override public void personaDiscarded(RuleNode g) { call("persona44OnPersonaDiscarded", g); }
        };
        JavaTurnRules rules = new JavaTurnRules(clock, effects);
        context.getBindings("js").putMember("__politikumNativeTurn", (ProxyExecutable) args -> {
            Object result = rules.invoke(args[0].asString(), new GraalRuleNode(args[1], parse), args[2].asString(), new GraalRuleNode(args[3], parse));
            return result instanceof GraalRuleNode node ? node.value() : result;
        });
        try (var in = new ClassPathResource("engine/turn-effects.js").getInputStream()) {
            context.eval("js", new String(in.readAllBytes(), StandardCharsets.UTF_8));
        }
    }
}
