package com.politikum.engine;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.BooleanNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.util.ArrayList;

/** Normalizes intentional native-engine contract changes when comparing with the frozen JS oracle. */
final class LegacyParity {
    private LegacyParity() {}

    static JsonNode normalize(JsonNode value) {
        JsonNode copy = value.deepCopy();
        normalizeInPlace(copy);
        return copy;
    }

    private static void normalizeInPlace(JsonNode value) {
        if (!value.isObject()) {
            if (value.isArray()) value.forEach(LegacyParity::normalizeInPlace);
            return;
        }
        ObjectNode object = (ObjectNode) value;
        var names = new ArrayList<String>();
        object.fieldNames().forEachRemaining(names::add);
        for (String name : names) {
            if (name.equals("lastEventOwnerId") || name.equals("lastEventSequence")) {
                object.remove(name);
            } else if ((name.equals("gameOver") || name.equals("gameover")) && object.get(name).isObject()) {
                object.set(name, BooleanNode.TRUE);
            } else {
                normalizeInPlace(object.get(name));
            }
        }
    }
}
