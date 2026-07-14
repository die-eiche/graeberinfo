package de.familie.kontoauszug.data

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

class SentLogRepository(context: Context) {
    private val file = File(context.filesDir, "sent_log.json")

    fun hasSent(statementId: String): Boolean = loadIds().contains(statementId)

    fun markSent(statementId: String, filename: String, mailedTo: String) {
        val root = if (file.exists()) JSONObject(file.readText()) else JSONObject()
        val items = root.optJSONArray("sent") ?: JSONArray()
        val entry = JSONObject()
            .put("id", statementId)
            .put("filename", filename)
            .put("mailedTo", mailedTo)
            .put("sentAt", System.currentTimeMillis())
        items.put(entry)
        root.put("sent", items)
        file.writeText(root.toString(2))
    }

    private fun loadIds(): Set<String> {
        if (!file.exists()) return emptySet()
        val root = JSONObject(file.readText())
        val items = root.optJSONArray("sent") ?: return emptySet()
        return buildSet {
            for (i in 0 until items.length()) {
                add(items.getJSONObject(i).getString("id"))
            }
        }
    }
}
