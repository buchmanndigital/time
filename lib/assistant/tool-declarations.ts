import { SchemaType, type FunctionDeclaration } from "@google/generative-ai";

export const ASSISTANT_FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "get_customer_details",
    description:
      "Liefert alle in TIME gespeicherten Infos zu einem Kunden: Name, angelegt am, alle zugeordneten Aufgaben (Titel, Status, Beschreibung, Termin, Dauer). Zuerst nutzen bei „was wissen wir über …“, „Übersicht Kunde …“. customer_id von list_customers.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        customer_id: { type: SchemaType.STRING, description: "UUID des Kunden" },
      },
      required: ["customer_id"],
    },
  },
  {
    name: "web_research",
    description:
      "Öffentliche Web-Recherche (Browser-Automation über Browser Use Cloud): Firma, Adresse, Thema – ergänzt TIME-Daten. Präzise Suchanfrage formulieren. Quellen in der Antwort nennen. Erfordert BROWSER_USE_API_KEY (API-Key wie bei browser-use CLI, cloud.browser-use.com).",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: {
          type: SchemaType.STRING,
          description: "Suchbegriff(e) / Frage für die Websuche (deutsch möglich)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "list_customers",
    description:
      "Listet alle Kunden mit UUID (id) und Namen. Nutze ids für Zuordnung von Aufgaben oder zum Bearbeiten.",
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
  {
    name: "list_tasks",
    description:
      "Listet Kanban-/Kalender-Aufgaben mit id, Titel, Status, Termin (starts_at ISO oder null), Dauer, Kunde, optionalem potentiellen Betrag (potential_amount_eur, EUR).",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        filter_title: {
          type: SchemaType.STRING,
          description: "Optional: nur Aufgaben, deren Titel diesen Text enthalten (Groß/Klein egal).",
        },
      },
    },
  },
  {
    name: "create_customer",
    description: "Legt einen neuen Kunden mit Anzeigenamen an.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        name: { type: SchemaType.STRING, description: "Anzeigename des Kunden" },
      },
      required: ["name"],
    },
  },
  {
    name: "update_customer",
    description: "Benennt einen bestehenden Kunden um (id von list_customers).",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        customer_id: { type: SchemaType.STRING },
        name: { type: SchemaType.STRING, description: "Neuer Name" },
      },
      required: ["customer_id", "name"],
    },
  },
  {
    name: "delete_customer",
    description:
      "Löscht einen Kunden. Zugeordnete Aufgaben behalten den Termin, Kunde wird von Aufgaben getrennt.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        customer_id: { type: SchemaType.STRING },
      },
      required: ["customer_id"],
    },
  },
  {
    name: "create_task",
    description:
      "Neue Aufgabe. Status: open | in_progress | paused | done (default open). Optional Kunde (customer_id), Beschreibung, Start (starts_at_iso), Dauer in Minuten, potentieller Betrag in EUR (potential_amount_eur).",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        title: { type: SchemaType.STRING },
        status: {
          type: SchemaType.STRING,
          description: "open | in_progress | paused | done",
        },
        description: { type: SchemaType.STRING },
        customer_id: { type: SchemaType.STRING, description: "UUID oder leer" },
        starts_at_iso: {
          type: SchemaType.STRING,
          description:
            "Datum/Uhrzeit, z. B. 2026-04-15T14:00:00 — ohne Z/Offset = Uhrzeit Europe/Berlin (DE). Optional …Z oder ±HH:MM",
        },
        duration_minutes: { type: SchemaType.INTEGER, description: "Optional, 0 oder leer = keine feste Dauer" },
        potential_amount_eur: {
          type: SchemaType.NUMBER,
          description: "Optional: geschätzter Umsatz/Auftragswert in EUR (ohne Währung).",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "update_task",
    description:
      "Aufgabe ändern. Nur angegebene Felder setzen. clear_schedule=true entfernt Termin und Dauer. clear_potential_amount=true entfernt den potentiellen Betrag.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        task_id: { type: SchemaType.STRING },
        title: { type: SchemaType.STRING },
        description: { type: SchemaType.STRING, description: "Leerstring löscht Beschreibung" },
        status: { type: SchemaType.STRING, description: "open | in_progress | paused | done" },
        customer_id: { type: SchemaType.STRING, description: "UUID oder leer zum Entfernen" },
        starts_at_iso: {
          type: SchemaType.STRING,
          description: "ISO; ohne Z/Offset = Berlin-Ortszeit; leer optional",
        },
        duration_minutes: { type: SchemaType.INTEGER },
        potential_amount_eur: {
          type: SchemaType.NUMBER,
          description: "Optional: neuer potentieller Betrag in EUR.",
        },
        clear_potential_amount: {
          type: SchemaType.BOOLEAN,
          description: "true = potentiellen Betrag entfernen",
        },
        clear_schedule: {
          type: SchemaType.BOOLEAN,
          description: "true = Termin und Dauer entfernen",
        },
      },
      required: ["task_id"],
    },
  },
  {
    name: "delete_task",
    description: "Löscht eine Aufgabe dauerhaft.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        task_id: { type: SchemaType.STRING },
      },
      required: ["task_id"],
    },
  },
  {
    name: "list_imap_folders",
    description:
      "Listet alle IMAP-Ordner mit exaktem path (für list_imap_emails). Pflicht-Start bei fast jeder E-Mail-Suche: Nutzer legen Korrespondenz oft in Unterordnern (Kunden, Projekte). Nach list_customers o. Ä. Ordnernamen mit Kundennamen abgleichen; dann passende Pfade für list_imap_emails nutzen. delimiter = Hierarchie (oft Punkt).",
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
  {
    name: "list_imap_emails",
    description:
      "Neueste Mails aus **einem** Ordner. mailbox leer = nur Posteingang (INBOX). Bei Fragen nach Mails zu einem Kunden/Thema: nicht nur INBOX — mehrere Aufrufe mit verschiedenen mailbox-Pfaden (von list_imap_folders), bis relevante Ordner geprüft sind. uid nur innerhalb dieses Ordners; für get_imap_email_content dieselbe mailbox.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        mailbox: {
          type: SchemaType.STRING,
          description:
            "IMAP-Ordnerpfad (von list_imap_folders). Fehlt oder leer = INBOX / Posteingang.",
        },
        limit: {
          type: SchemaType.INTEGER,
          description: "Max. Anzahl Mails (1–30, Standard 12).",
        },
        since_days: {
          type: SchemaType.INTEGER,
          description: "Optional: nur Mails der letzten X Tage (z. B. 14).",
        },
      },
    },
  },
  {
    name: "get_imap_email_content",
    description:
      "Lädt den Textinhalt einer E-Mail (uid von list_imap_emails). Derselbe mailbox-Pfad wie bei der Liste – sonst falsche Mail oder Fehler. Nur Lesen; Inhalt kurz zusammenfassen.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        mailbox: {
          type: SchemaType.STRING,
          description: "Gleicher Ordner wie bei list_imap_emails. Fehlt/leer = INBOX.",
        },
        uid: {
          type: SchemaType.INTEGER,
          description: "IMAP-UID der Nachricht (von list_imap_emails in diesem Ordner).",
        },
        max_chars: {
          type: SchemaType.INTEGER,
          description: "Optional: max. Zeichen Body (500–24000, Standard 12000).",
        },
      },
      required: ["uid"],
    },
  },
];
