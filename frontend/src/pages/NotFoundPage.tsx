import { Box, Typography, Button } from "@mui/material";
import { Home } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        textAlign: "center",
      }}
    >
      <Typography variant="h1" sx={{ fontWeight: 700, color: "text.secondary", mb: 2 }}>
        404
      </Typography>
      <Typography variant="h4" gutterBottom>
        页面未找到
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        抱歉，您访问的页面不存在
      </Typography>
      <Button
        variant="contained"
        size="large"
        startIcon={<Home />}
        onClick={() => navigate("/")}
      >
        返回首页
      </Button>
    </Box>
  );
}
