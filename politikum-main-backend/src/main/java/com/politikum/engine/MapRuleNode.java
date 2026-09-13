package com.politikum.engine;

import java.util.*;

/** Mutable map/list view that preserves card identity across native rule calls. */
public final class MapRuleNode implements RuleNode {
    private final Object value;
    public MapRuleNode(Object value) { this.value=value; }
    public Object value() { return value; }
    public static MapRuleNode of(Object value) { return new MapRuleNode(mutable(value)); }
    private static Object mutable(Object value) {
        if(value instanceof MapRuleNode node)return node.value;
        if(value instanceof Number n)return Double.isFinite(n.doubleValue())?JavaScoringRules.numeric(n.doubleValue()):n.doubleValue();
        if(value instanceof Map<?,?> map) { Map<String,Object> out=new LinkedHashMap<>();map.forEach((k,v)->out.put(String.valueOf(k),mutable(v)));return out; }
        if(value instanceof List<?> list) { List<Object> out=new ArrayList<>();for(Object v:list)out.add(mutable(v));return out; }
        return value;
    }
    public RuleNode get(String key) { return new MapRuleNode(value instanceof Map<?,?> map?map.get(key):null); }
    public RuleNode at(int index) { return new MapRuleNode(value instanceof List<?> list&&index>=0&&index<list.size()?list.get(index):null); }
    @SuppressWarnings("unchecked") public void set(String key,Object item) {
        if(value instanceof List<?> list)((List<Object>)list).set(Integer.parseInt(key),mutable(item));
        else ((Map<String,Object>)value).put(key,mutable(item));
    }
    @SuppressWarnings("unchecked") public void add(Object item) { ((List<Object>)value).add(mutable(item)); }
    public RuleNode removeAt(int index) { return new MapRuleNode(((List<?>)value).remove(index)); }
    public void remove(String key) { ((Map<?,?>)value).remove(key); }
    public boolean missing() { return value==null; }
    public boolean array() { return value instanceof List<?>; }
    public int size() { return value instanceof List<?> list?list.size():0; }
    public String text() { return value==null?"":value instanceof Number n?String.valueOf(JavaScoringRules.numeric(n.doubleValue())):value instanceof Map?"[object Object]":String.valueOf(value); }
    public double number() { return value==null?0:value instanceof Boolean b?(b?1:0):JavaScoringRules.number(value); }
    public boolean truthy() { return GameState.truthy(value)&&!(value instanceof Number n&&Double.isNaN(n.doubleValue())); }
}
