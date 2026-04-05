import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

export type MovementLogsPdfRow = {
  id: string;
  timestamp: string;
  time: string;
  productName: string;
  sku: string;
  typeLabel: string;
  quantity: number;
  operatorPrimary: string;
  reason: string | null;
};

type MovementLogsPdfDocumentProps = {
  rows: MovementLogsPdfRow[];
  generatedAt: string;
  filterSummary: string;
  inboundVolume: number;
  outboundVolume: number;
  operatorCount: number;
};

const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#1f2937",
    backgroundColor: "#ffffff",
  },
  header: {
    marginBottom: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#dbe3ef",
  },
  brand: {
    fontSize: 9,
    color: "#4f46e5",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 4,
  },
  subtitle: {
    color: "#64748b",
    lineHeight: 1.5,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    gap: 12,
  },
  metaBlock: {
    flexGrow: 1,
  },
  metaLabel: {
    fontSize: 8,
    textTransform: "uppercase",
    color: "#94a3b8",
    marginBottom: 3,
    letterSpacing: 0.8,
  },
  metaValue: {
    fontSize: 10,
    color: "#334155",
  },
  kpiRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  kpiCard: {
    flexGrow: 1,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#f8fafc",
  },
  kpiLabel: {
    fontSize: 8,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: 700,
    color: "#1e3a8a",
    marginBottom: 4,
  },
  kpiNote: {
    fontSize: 9,
    color: "#64748b",
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 8,
    color: "#111827",
  },
  table: {
    borderWidth: 1,
    borderColor: "#dbe3ef",
    borderRadius: 10,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#eef2ff",
    borderBottomWidth: 1,
    borderBottomColor: "#dbe3ef",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eef2f7",
  },
  colDate: {
    width: "13%",
    paddingRight: 8,
  },
  colProduct: {
    width: "22%",
    paddingRight: 8,
  },
  colType: {
    width: "13%",
    paddingRight: 8,
  },
  colQty: {
    width: "10%",
    paddingRight: 8,
  },
  colOperator: {
    width: "17%",
    paddingRight: 8,
  },
  colNotes: {
    width: "25%",
  },
  headerText: {
    fontSize: 8,
    fontWeight: 700,
    color: "#4338ca",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  bodyText: {
    fontSize: 9,
    color: "#1f2937",
    lineHeight: 1.4,
  },
  bodyTextMuted: {
    fontSize: 8,
    color: "#64748b",
    lineHeight: 1.4,
  },
  footer: {
    position: "absolute",
    left: 28,
    right: 28,
    bottom: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 8,
  },
});

export default function MovementLogsPdfDocument({
  rows,
  generatedAt,
  filterSummary,
  inboundVolume,
  outboundVolume,
  operatorCount,
}: MovementLogsPdfDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>Indigo Ledger</Text>
          <Text style={styles.title}>Movement Log Report</Text>
          <Text style={styles.subtitle}>
            Exported inventory movement history with the currently applied filters.
          </Text>

          <View style={styles.metaRow}>
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>Generated</Text>
              <Text style={styles.metaValue}>{generatedAt}</Text>
            </View>
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>Filters</Text>
              <Text style={styles.metaValue}>{filterSummary}</Text>
            </View>
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>Records</Text>
              <Text style={styles.metaValue}>{rows.length}</Text>
            </View>
          </View>
        </View>

        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Inbound Volume</Text>
            <Text style={styles.kpiValue}>{inboundVolume}</Text>
            <Text style={styles.kpiNote}>Units added to stock</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Outbound Volume</Text>
            <Text style={styles.kpiValue}>{outboundVolume}</Text>
            <Text style={styles.kpiNote}>Units removed from stock</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Operators</Text>
            <Text style={styles.kpiValue}>{operatorCount}</Text>
            <Text style={styles.kpiNote}>Distinct contributors</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Movement Records</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={styles.colDate}><Text style={styles.headerText}>Date</Text></View>
            <View style={styles.colProduct}><Text style={styles.headerText}>Product</Text></View>
            <View style={styles.colType}><Text style={styles.headerText}>Type</Text></View>
            <View style={styles.colQty}><Text style={styles.headerText}>Qty</Text></View>
            <View style={styles.colOperator}><Text style={styles.headerText}>Operator</Text></View>
            <View style={styles.colNotes}><Text style={styles.headerText}>Notes</Text></View>
          </View>

          {rows.slice(0, 24).map((row) => (
            <View key={row.id} style={styles.tableRow}>
              <View style={styles.colDate}>
                <Text style={styles.bodyText}>{row.timestamp}</Text>
                <Text style={styles.bodyTextMuted}>{row.time}</Text>
              </View>
              <View style={styles.colProduct}>
                <Text style={styles.bodyText}>{row.productName}</Text>
                <Text style={styles.bodyTextMuted}>{row.sku.replace(/^SKU:\s*/, "")}</Text>
              </View>
              <View style={styles.colType}><Text style={styles.bodyText}>{row.typeLabel}</Text></View>
              <View style={styles.colQty}><Text style={styles.bodyText}>{row.quantity}</Text></View>
              <View style={styles.colOperator}><Text style={styles.bodyText}>{row.operatorPrimary}</Text></View>
              <View style={styles.colNotes}>
                <Text style={styles.bodyText}>{row.reason ?? "-"}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.bodyTextMuted}>Indigo Ledger export</Text>
          <Text
            style={styles.bodyTextMuted}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
