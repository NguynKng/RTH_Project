import { createBrowserRouter, Navigate } from "react-router";
import { BoardPage } from "./BoardPage";
import { DetailDrawer } from "../components/DetailDrawer";
export const router = createBrowserRouter([
  {
    path: "/",
    element: <BoardPage />,
    children: [{ path: "requests/:id", element: <DetailDrawer /> }],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
