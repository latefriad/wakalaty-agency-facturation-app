import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, setToken, clearToken } from "../services/api";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [agency, setAgency] = useState(null);
  const [agencyId, setAgencyId] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    const token = localStorage.getItem("wakalati_token");
    if (!token) return null;

    try {
      const res = await api.get("/auth/me");
      const { user: u, agency: a } = res.data;
      setUser({ uid: u.id, email: u.email });
      setProfile({ uid: u.id, ...u });
      setAgency(a);
      setAgencyId(a.id);
      return res.data;
    } catch {
      clearToken();
      setUser(null);
      setProfile(null);
      setAgency(null);
      setAgencyId(null);
      return null;
    }
  }, []);

  const login = async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    const { token, user: u, agency: a } = res.data;
    setToken(token);
    setUser({ uid: u.id, email: u.email });
    setProfile({ uid: u.id, ...u });
    setAgency(a);
    setAgencyId(a.id);
    return { cred: { user: { uid: u.id } }, profile: { uid: u.id, ...u } };
  };

  const registerAgency = async ({ agencyName, email, password, ownerName }) => {
    const res = await api.post("/auth/register", {
      email,
      password,
      name: ownerName,
      agencyName,
    });
    const { token, user: u, agency: a } = res.data;
    setToken(token);
    setUser({ uid: u.id, email: u.email });
    setProfile({ uid: u.id, ...u });
    setAgency(a);
    setAgencyId(a.id);
    return { uid: u.id, agencyId: a.id };
  };

  const logout = () => {
    clearToken();
    setUser(null);
    setProfile(null);
    setAgency(null);
    setAgencyId(null);
  };

  const updateAgency = async (data) => {
    if (!agencyId) return;
    await api.put(`/agencies/me`, data);
    setAgency((prev) => ({ ...prev, ...data }));
  };

  const updateUserProfile = async ({ name, email }) => {
    if (!user) return;
    const data = {};
    if (name) data.name = name;
    if (email) data.email = email;
    if (Object.keys(data).length > 0) {
      await api.put("/auth/me", data);
      setProfile((prev) => ({ ...prev, ...data }));
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    await api.post("/auth/change-password", { currentPassword, newPassword });
  };

  const isAdmin = profile?.role === "ADMIN";
  const isSuperAdmin = false;

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 5000);

    fetchMe().finally(() => {
      clearTimeout(timeout);
      setLoading(false);
    });

    return () => clearTimeout(timeout);
  }, [fetchMe]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        agency,
        agencyId,
        loading,
        login,
        logout,
        registerAgency,
        updateAgency,
        updateUserProfile,
        changePassword,
        isAdmin,
        isSuperAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
