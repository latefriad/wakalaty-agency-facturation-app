export function useSubscription() {
  return {
    plan: "ENTERPRISE",
    canAdd: () => true,
    getLimit: () => Infinity,
    isFeatureAvailable: () => true,
    isExpired: false,
    daysLeft: 999,
  };
}

export default useSubscription;
