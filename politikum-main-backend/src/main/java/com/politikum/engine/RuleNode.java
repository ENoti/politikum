package com.politikum.engine;

/** Mutable state access, independent of the temporary Graal representation. */
public interface RuleNode {
    RuleNode get(String key);
    RuleNode at(int index);
    void set(String key, Object value);
    void add(Object value);
    RuleNode removeAt(int index);
    void remove(String key);
    boolean missing();
    boolean array();
    int size();
    String text();
    double number();
    boolean truthy();
}
