import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import BACKEND_URL from "../config";

// Counselors created before approvals existed have no `status`: they count as approved.
const statusOf = (c) => c.status || "approved";

const FILTERS = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

const BADGE = {
  pending: "bg-amber-300 text-amber-950",
  approved: "bg-green-300 text-green-950",
  rejected: "bg-red-300 text-red-950",
};

const AdminDashboard = ({ adminName }) => {
  const [counselors, setCounselors] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const headers = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/counselors`, {
        headers: headers(),
      });
      setCounselors(res.data);
    } catch (err) {
      setError(
        err.response?.data?.message || "Could not load counselors"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (counselor, status) => {
    setBusyId(counselor._id);
    setError("");
    setNotice("");
    try {
      const res = await axios.patch(
        `${BACKEND_URL}/api/admin/counselors/${counselor._id}`,
        { status },
        { headers: headers() }
      );
      setCounselors((prev) =>
        prev.map((c) => (c._id === counselor._id ? { ...c, ...res.data } : c))
      );
      setNotice(
        `${counselor.name} is now ${status}.`
      );
    } catch (err) {
      setError(
        err.response?.data?.message || "Could not update counselor"
      );
    } finally {
      setBusyId(null);
    }
  };

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0, all: counselors.length };
    counselors.forEach((x) => {
      c[statusOf(x)] += 1;
    });
    return c;
  }, [counselors]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return counselors.filter((c) => {
      if (filter !== "all" && statusOf(c) !== filter) return false;
      if (!q) return true;
      return (
        c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q)
      );
    });
  }, [counselors, filter, query]);

  const renderActions = (c) => {
    const status = statusOf(c);
    const busy = busyId === c._id;
    const btn =
      "px-3 py-1 rounded text-white disabled:opacity-60 disabled:cursor-not-allowed";

    return (
      <div className="flex gap-2 mt-3 sm:mt-0 sm:ml-4 shrink-0">
        {status !== "approved" && (
          <button
            disabled={busy}
            onClick={() => setStatus(c, "approved")}
            className={`${btn} bg-green-600 hover:bg-green-700`}
          >
            Approve
          </button>
        )}
        {status === "pending" && (
          <button
            disabled={busy}
            onClick={() => setStatus(c, "rejected")}
            className={`${btn} bg-red-600 hover:bg-red-700`}
          >
            Reject
          </button>
        )}
        {status === "approved" && (
          <button
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  `Revoke access for ${c.name}? They will be signed out and unable to log in.`
                )
              ) {
                setStatus(c, "rejected");
              }
            }}
            className={`${btn} bg-red-600 hover:bg-red-700`}
          >
            Revoke
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="bg-[url(/images/image2.png)] p-4 sm:p-6 min-h-screen mx-auto space-y-6">
      <h2 className="text-3xl sm:text-5xl font-bold mb-4 px-4 sm:px-20 bg-teal-400 text-teal-950 text-shadow-lg text-shadow-teal-100">
        Admin Console{adminName ? ` · ${adminName}` : ""}
      </h2>

      <div className="bg-teal ml-2 sm:ml-12 mr-2 sm:mr-12 rounded-2xl shadow-lg p-2 flex flex-col md:flex-row gap-4 h-auto md:h-[85vh] overflow-hidden">
        {/* Left: stats + counselor list */}
        <div className="w-full md:w-2/3 flex flex-col min-h-0">
          <div className="text-lg sm:text-2xl p-4 sm:p-6 bg-gradient-to-r from-teal-950 to-teal-700 m-2 sm:m-5 rounded-xl text-teal-100 text-center">
            Review and approve the counselors who can talk to students.
          </div>

          <div className="bg-gradient-to-r from-teal-950 to-teal-700 m-2 sm:m-5 p-4 rounded-xl shadow flex flex-col min-h-0 flex-1">
            <div className="flex flex-wrap gap-2 mb-3">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`px-3 py-1 rounded-full text-sm sm:text-base ${
                    filter === f.key
                      ? "bg-teal-300 text-teal-950"
                      : "bg-teal-900 text-teal-100 hover:bg-teal-800"
                  }`}
                >
                  {f.label} ({counts[f.key]})
                </button>
              ))}

              <input
                type="search"
                placeholder="Search name or email"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="ml-auto w-full sm:w-56 border p-1 px-3 rounded-full bg-white text-black"
              />
            </div>

            {error && (
              <div className="mb-3 p-2 bg-red-600 text-white rounded text-center">
                {error}
              </div>
            )}
            {notice && !error && (
              <div className="mb-3 p-2 bg-teal-200 text-teal-950 rounded text-center">
                {notice}
              </div>
            )}

            <div className="overflow-y-auto pr-1 flex-1 max-h-[55vh] md:max-h-none">
              {loading ? (
                <p className="text-teal-100 italic text-center">Loading...</p>
              ) : visible.length === 0 ? (
                <p className="text-teal-100 italic text-center">
                  {filter === "pending"
                    ? "No counselors are waiting for approval."
                    : "No counselors match."}
                </p>
              ) : (
                visible.map((c) => (
                  <div
                    key={c._id}
                    className="border p-4 rounded shadow bg-gray-600 flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 w-full"
                  >
                    <div className="text-left text-white w-full">
                      <p>
                        <strong>Name:</strong> Dr. {c.name}{" "}
                        <span
                          className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                            BADGE[statusOf(c)]
                          }`}
                        >
                          {statusOf(c)}
                        </span>
                      </p>
                      <p className="break-all">
                        <strong>Email:</strong> {c.email}
                      </p>
                      {c.createdAt && (
                        <p>
                          <strong>Signed up:</strong>{" "}
                          {new Date(c.createdAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    {renderActions(c)}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: overview */}
        <div className="bg-gradient-to-r from-teal-700 to-teal-400 m-2 sm:m-5 w-full md:w-1/3 p-4 rounded-xl shadow overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg sm:text-xl font-semibold text-teal-50">
              Overview
            </h3>
            <button
              onClick={load}
              disabled={loading}
              className="px-3 py-1 rounded bg-teal-900 text-teal-100 hover:bg-teal-800 disabled:opacity-60 text-sm"
            >
              Refresh
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              ["Pending", counts.pending, "pending"],
              ["Approved", counts.approved, "approved"],
              ["Rejected", counts.rejected, "rejected"],
              ["Total", counts.all, "all"],
            ].map(([label, value, key]) => (
              <button
                key={label}
                onClick={() => setFilter(key)}
                className="rounded-xl bg-teal-950 text-teal-100 p-4 shadow hover:bg-teal-900"
              >
                <div className="text-3xl font-bold">{value}</div>
                <div className="text-sm text-teal-200">{label}</div>
              </button>
            ))}
          </div>

          <p className="mt-4 text-sm text-teal-50 text-left">
            Approved counselors appear in the students' booking list. Revoking a
            counselor signs them out immediately and hides them from students.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
