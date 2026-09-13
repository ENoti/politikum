package com.politikum.engine;

import com.politikum.util.JsonUtils;
import org.graalvm.polyglot.Value;

/** Writes guest values directly so card/array references survive native callbacks. */
public final class GraalRuleNode implements RuleNode {
    private final Value value;
    private final Value parse;

    public GraalRuleNode(Value value, Value parse) { this.value = value; this.parse = parse; }
    public Value value() { return value; }
    @Override public RuleNode get(String key) { return new GraalRuleNode(missing() ? null : value.getMember(key), parse); }
    @Override public RuleNode at(int index) { return new GraalRuleNode(index < 0 || index >= size() ? null : value.getArrayElement(index), parse); }
    private Object guest(Object item) {
        if (item instanceof GraalRuleNode node) return node.value;
        if (item == null || item instanceof String || item instanceof Number || item instanceof Boolean) return item;
        return parse.execute(JsonUtils.stringify(item));
    }
    @Override public void set(String key, Object item) { value.putMember(key, guest(item)); }
    @Override public void add(Object item) { value.invokeMember("push", guest(item)); }
    @Override public RuleNode removeAt(int index) { return new GraalRuleNode(value.invokeMember("splice", index, 1).getArrayElement(0), parse); }
    @Override public void remove(String key) { value.removeMember(key); }
    @Override public boolean missing() { return value == null || value.isNull(); }
    @Override public boolean array() { return !missing() && value.hasArrayElements(); }
    @Override public int size() { return array() ? Math.toIntExact(value.getArraySize()) : 0; }
    @Override public String text() {
        if (missing()) return "";
        if (value.isString()) return value.asString();
        if (value.isNumber()) return value.fitsInLong() ? Long.toString(value.asLong()) : Double.toString(value.asDouble());
        if (value.isBoolean()) return Boolean.toString(value.asBoolean());
        return value.toString();
    }
    @Override public double number() { return missing() ? 0 : value.isBoolean() ? (value.asBoolean() ? 1 : 0) : JavaScoringRules.number(text()); }
    @Override public boolean truthy() {
        if (missing()) return false;
        if (value.isBoolean()) return value.asBoolean();
        if (value.isNumber()) return value.asDouble() != 0 && !Double.isNaN(value.asDouble());
        return !value.isString() || !value.asString().isEmpty();
    }
}
