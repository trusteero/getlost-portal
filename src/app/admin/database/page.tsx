"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Database, Table, Search, RefreshCw } from "lucide-react";
import { ErrorBoundary } from "@/components/error-boundary";

interface TableInfo {
  name: string;
  rowCount: number;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
  }>;
}

interface QueryResult {
  columns: string[];
  rows: any[][];
  error?: string;
}

function DatabaseViewerContent() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<any[]>([]);
  const [query, setQuery] = useState<string>("");
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/login");
    }
  }, [session, isPending, router]);

  useEffect(() => {
    if (session) {
      fetchTables();
    }
  }, [session]);

  const fetchTables = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/admin/database/tables");
      if (!response.ok) {
        throw new Error("Failed to fetch tables");
      }
      const data = await response.json();
      setTables(data);
    } catch (err) {
      console.error("[Database Viewer] Failed to fetch tables:", err);
      setError(err instanceof Error ? err.message : "Failed to load tables");
    } finally {
      setLoading(false);
    }
  };

  const fetchTableData = async (tableName: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/admin/database/tables/${encodeURIComponent(tableName)}`);
      if (!response.ok) {
        throw new Error("Failed to fetch table data");
      }
      const data = await response.json();
      setTableData(data.rows || []);
      setSelectedTable(tableName);
    } catch (err) {
      console.error("[Database Viewer] Failed to fetch table data:", err);
      setError(err instanceof Error ? err.message : "Failed to load table data");
    } finally {
      setLoading(false);
    }
  };

  const executeQuery = async () => {
    if (!query.trim()) return;

    try {
      setExecuting(true);
      setError(null);
      setQueryResult(null);
      const response = await fetch("/api/admin/database/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Query failed");
      }

      const data = await response.json();
      setQueryResult(data);
    } catch (err) {
      console.error("[Database Viewer] Query execution failed:", err);
      setError(err instanceof Error ? err.message : "Query execution failed");
      setQueryResult({
        columns: [],
        rows: [],
        error: err instanceof Error ? err.message : "Query execution failed",
      });
    } finally {
      setExecuting(false);
    }
  };

  if (isPending || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Database className="w-6 h-6" />
          Database Viewer
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          View and query your database tables. Read-only access for safety.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tables List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Table className="w-4 h-4" />
                Tables
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={fetchTables}
                className="h-6 w-6 p-0"
              >
                <RefreshCw className="w-3 h-3" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {tables.map((table) => (
                <button
                  key={table.name}
                  onClick={() => fetchTableData(table.name)}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                    selectedTable === table.name
                      ? "bg-blue-100 text-blue-900 font-medium"
                      : "hover:bg-gray-100 text-gray-700"
                  }`}
                >
                  <div className="font-medium">{table.name}</div>
                  <div className="text-xs text-gray-500">
                    {table.rowCount.toLocaleString()} rows
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Table Data / Query Results */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              {selectedTable ? `Table: ${selectedTable}` : "Query Results"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedTable && (
              <div className="mb-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b">
                        {tables
                          .find((t) => t.name === selectedTable)
                          ?.columns.map((col) => (
                            <th
                              key={col.name}
                              className="text-left py-2 px-3 font-medium text-gray-700"
                            >
                              {col.name}
                              <span className="text-xs text-gray-500 ml-1">
                                ({col.type})
                              </span>
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.slice(0, 100).map((row, idx) => (
                        <tr key={idx} className="border-b hover:bg-gray-50">
                          {tables
                            .find((t) => t.name === selectedTable)
                            ?.columns.map((col) => (
                              <td key={col.name} className="py-2 px-3 text-gray-600">
                                {row[col.name] !== null && row[col.name] !== undefined
                                  ? String(row[col.name]).substring(0, 100)
                                  : "NULL"}
                              </td>
                            ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {tableData.length > 100 && (
                  <p className="text-xs text-gray-500 mt-2">
                    Showing first 100 of {tableData.length.toLocaleString()} rows
                  </p>
                )}
              </div>
            )}

            {queryResult && (
              <div className="mt-4">
                {queryResult.error ? (
                  <div className="p-4 bg-red-50 border border-red-200 rounded text-red-800">
                    {queryResult.error}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="border-b">
                          {queryResult.columns.map((col) => (
                            <th
                              key={col}
                              className="text-left py-2 px-3 font-medium text-gray-700"
                            >
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {queryResult.rows.slice(0, 100).map((row, idx) => (
                          <tr key={idx} className="border-b hover:bg-gray-50">
                            {row.map((cell: any, cellIdx: number) => (
                              <td key={cellIdx} className="py-2 px-3 text-gray-600">
                                {cell !== null && cell !== undefined
                                  ? String(cell).substring(0, 100)
                                  : "NULL"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {!selectedTable && !queryResult && (
              <div className="text-center py-12 text-gray-500">
                Select a table or run a query to view data
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* SQL Query Editor */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-4 h-4" />
            SQL Query
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="SELECT * FROM getlostportal_book LIMIT 10;"
              className="w-full h-32 px-3 py-2 border rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex items-center gap-2">
              <Button
                onClick={executeQuery}
                disabled={executing || !query.trim()}
              >
                {executing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Executing...
                  </>
                ) : (
                  "Execute Query"
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setQueryResult(null);
                  setSelectedTable(null);
                  setTableData([]);
                }}
              >
                Clear
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              ⚠️ Read-only queries only. SELECT statements are safe to run.
            </p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

export default function DatabaseViewer() {
  return (
    <ErrorBoundary>
      <DatabaseViewerContent />
    </ErrorBoundary>
  );
}

