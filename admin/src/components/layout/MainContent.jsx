const MainContent = ({ children }) => {
  return (
    <div
      style={{
        padding: "24px",
        flex: 1,
        overflowY: "auto",
        background: "var(--admin-main-bg)",
      }}
    >
      {children}
    </div>
  );
};

export default MainContent;
