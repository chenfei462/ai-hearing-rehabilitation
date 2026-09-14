import { Box, Typography, Paper, TextField, IconButton, List, ListItem, ListItemText, Avatar } from "@mui/material";
import { Send, Mic } from "@mui/icons-material";
import { useState } from "react";

interface Message {
  id: number;
  text: string;
  sender: "user" | "ai";
  timestamp: Date;
}

export default function ConversationPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: "你好！我是你的听觉康复助手。今天想练习什么内容呢？",
      sender: "ai",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim()) return;

    // 添加用户消息
    const userMessage: Message = {
      id: messages.length + 1,
      text: input,
      sender: "user",
      timestamp: new Date(),
    };
    setMessages([...messages, userMessage]);
    setInput("");

    // 模拟AI回复
    setTimeout(() => {
      const aiMessage: Message = {
        id: messages.length + 2,
        text: "收到！让我们一起练习。",
        sender: "ai",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    }, 1000);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "calc(100vh - 200px)" }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
        对话练习
      </Typography>

      <Paper
        elevation={0}
        sx={{
          flex: 1,
          overflow: "auto",
          p: 2,
          mb: 2,
          bgcolor: "grey.50",
          borderRadius: 3,
        }}
      >
        <List>
          {messages.map((msg) => (
            <ListItem
              key={msg.id}
              sx={{
                flexDirection: msg.sender === "user" ? "row-reverse" : "row",
                alignItems: "flex-start",
                mb: 2,
              }}
            >
              <Avatar
                sx={{
                  bgcolor: msg.sender === "user" ? "primary.main" : "secondary.main",
                  width: 48,
                  height: 48,
                }}
              >
                {msg.sender === "user" ? "我" : "AI"}
              </Avatar>
              <Paper
                elevation={1}
                sx={{
                  p: 2,
                  mx: 2,
                  maxWidth: "70%",
                  borderRadius: 3,
                  bgcolor: msg.sender === "user" ? "primary.light" : "white",
                }}
              >
                <Typography variant="body1">{msg.text}</Typography>
              </Paper>
            </ListItem>
          ))}
        </List>
      </Paper>

      <Box sx={{ display: "flex", gap: 1 }}>
        <IconButton color="primary" sx={{ minWidth: 48, minHeight: 48 }}>
          <Mic />
        </IconButton>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="输入你想说的话..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleSend()}
          sx={{ "& .MuiInputBase-root": { borderRadius: 3 } }}
        />
        <IconButton
          color="primary"
          onClick={handleSend}
          disabled={!input.trim()}
          sx={{ minWidth: 48, minHeight: 48 }}
        >
          <Send />
        </IconButton>
      </Box>
    </Box>
  );
}
