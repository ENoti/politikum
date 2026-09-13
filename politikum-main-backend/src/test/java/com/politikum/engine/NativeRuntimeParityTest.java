package com.politikum.engine;

import com.politikum.util.JsonUtils;
import org.graalvm.polyglot.*;
import org.graalvm.polyglot.proxy.ProxyExecutable;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class NativeRuntimeParityTest {
    @Test void nativeMovesMatchLegacyAcrossAllMigrationScenarios() throws Exception {
        int[] count={0};
        for(String script:List.of("ability","token-ability","recovery-ability","topdeck-ability","coalition-ability","hand-ability","response-ability","remaining-persona","event","action","runtime")) {
            try(Context guest=Context.newBuilder("js").build()) {
                var catalog=new CardCatalog();guest.getBindings("js").putMember("__politikumCatalogJson",catalog.json());
                var scoring=new ScoringBridge();guest.getBindings("js").putMember("__politikumNativeScoring",(ProxyExecutable)a->scoring.execute(a[0].asString(),a[1].asString()));
                Clock clock=new Clock(){public ZoneId getZone(){return ZoneOffset.UTC;}public Clock withZone(ZoneId zone){return this;}public Instant instant(){return Instant.ofEpochMilli(millis());}public long millis(){return guest.eval("js","Date.now()").asLong();}};
                GraalTurnBridge.install(guest,clock);guest.eval("js",read("engine/politikum-engine-bridge.js"));
                var nativeEngine=new JavaGameEngine(catalog,clock,()->guest.eval("js","Math.random()").asDouble());
                guest.getBindings("js").putMember("__javaMove",(ProxyExecutable)a->{
                    Map<String,Object> state=JsonUtils.parseMap(a[0].asString());String before=JsonUtils.stringify(state);
                    List<Object> args=GameState.list(JsonUtils.parseMap("{\"args\":"+a[3].asString()+"}").get("args"));
                    var result=nativeEngine.applyMove(state,a[1].asString(),a[2].asString(),args);
                    assertEquals(before,JsonUtils.stringify(state),"input mutation");return JsonUtils.stringify(result);
                });
                guest.getBindings("js").putMember("__compareMove",(ProxyExecutable)a->{
                    try {var expected=JsonUtils.mapper().readTree(a[0].asString());var actual=JsonUtils.mapper().readTree(a[1].asString());
                        assertEquals(expected,actual,script+" "+a[2].asString());count[0]++;return true;
                    } catch(java.io.IOException e){throw new RuntimeException(e);}
                });
                guest.eval("js","const legacyApplyMove=applyMove;applyMove=(s,p,m,a=[])=>{const expected=legacyApplyMove(s,p,m,a);const actual=JSON.parse(__javaMove(JSON.stringify(s),String(p),m,JSON.stringify(a)));__compareMove(JSON.stringify(expected),JSON.stringify(actual),m);return actual;}");
                guest.eval("js",read("engine/"+script+"-scenarios.js"));
                if(script.equals("runtime")) {
                    guest.getBindings("js").putMember("__turnCases",read("engine/turn-legacy.json"));
                    guest.eval("js","for(const t of JSON.parse(__turnCases))applyMove(t.input,t.actor,t.move,t.args);");
                }
            }
        }
        assertTrue(count[0]>1900,"Must exercise the native runtime, not only direct legacy ability calls");
        System.out.println("Native runtime parity moves: "+count[0]);
    }
    private static String read(String name)throws Exception {try(var in=new ClassPathResource(name).getInputStream()){return new String(in.readAllBytes(),StandardCharsets.UTF_8);}}
}
