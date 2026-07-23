const MainContent = ({ children }) => {
  return (
    <div
      style={{
        padding: "24px",
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        overscrollBehavior: "contain",
        background: "var(--admin-main-bg)",
      }}
    >
      {children}
    </div>
  );
};

export default MainContent;
