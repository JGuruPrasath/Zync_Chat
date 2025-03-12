const asyncHandler = require("express-async-handler");
const Chat = require("../models/chatModel");
const User = require("../models/userModel");

//@description     Create or fetch One-to-One Chat
//@route           POST /api/chat/
//@access          Protected
const accessChat = asyncHandler(async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    console.log("UserId param not sent with request");
    return res.sendStatus(400);
  }

  // Search for chat between the logged-in user and another user
  let isChat = await Chat.find({
    isGroupChat: false,
    users: { $all: [req.user._id, userId] }, // Ensure both users are in the chat
  })
    .populate("users", "name pic email") // Populates user details
    .populate("latestMessage");
    console.log(isChat); // Debug log to check what data is being fetched

  isChat = await User.populate(isChat, {
    path: "latestMessage.sender", // Ensure that the latest message's sender is populated correctly
    select: "name pic email",
  });
  
  // Ensure that the correct user data is being used in the chat
  if (isChat.length > 0) {
    return res.send(isChat[0]); // Return the chat with the correct details
  } else {
    // Create a new chat if no chat exists
    const chatData = {
      chatName: "sender",
      isGroupChat: false,
      users: [req.user._id, userId],
    };

    try {
      const createdChat = await Chat.create(chatData);

      const fullChat = await Chat.findOne({ _id: createdChat._id })
        .populate("users", "name pic email")
        .populate("latestMessage");

      await User.populate(fullChat.latestMessage, {
        path: "sender",
        select: "name pic email",
      });

      res.status(200).json(fullChat);
    } catch (error) {
      res.status(400);
      throw new Error(error.message);
    }
  }
});

//@description     Fetch all chats for a user
//@route           GET /api/chat/
//@access          Protected
const fetchChats = asyncHandler(async (req, res) => {
  try {
    // Fetch all chats for the logged-in user
    const chats = await Chat.find({ users: req.user._id })
      .populate("users", "name pic email")
      .populate("groupAdmin", "name pic email")
      .populate("latestMessage")
      .sort({ updatedAt: -1 });

    // Populate sender details for the latest message in each chat
    const fullChats = await User.populate(chats, {
      path: "latestMessage.sender", // Populating sender info for the latest message
      select: "name pic email",
    });

    res.status(200).json(fullChats);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

//@description     Create New Group Chat
//@route           POST /api/chat/group
//@access          Protected
const createGroupChat = asyncHandler(async (req, res) => {
  if (!req.body.users || !req.body.name) {
    return res.status(400).send({ message: "Please fill all the fields" });
  }

  let users = JSON.parse(req.body.users);

  if (users.length < 2) {
    return res
      .status(400)
      .send("More than 2 users are required to form a group chat");
  }

  users.push(req.user); // Add the logged-in user to the group

  try {
    const groupChat = await Chat.create({
      chatName: req.body.name,
      users,
      isGroupChat: true,
      groupAdmin: req.user,
    });

    const fullGroupChat = await Chat.findById(groupChat._id)
      .populate("users", "name pic email")
      .populate("groupAdmin", "name pic email");

    // Ensure that the sender details for the latest message are populated correctly
    const fullGroupChatWithLatestMessage = await User.populate(fullGroupChat, {
      path: "latestMessage.sender", // Populating sender info for the latest message
      select: "name pic email",
    });

    res.status(200).json(fullGroupChatWithLatestMessage);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

// @desc    Rename Group
// @route   PUT /api/chat/rename
// @access  Protected
const renameGroup = asyncHandler(async (req, res) => {
  const { chatId, chatName } = req.body;

  const updatedChat = await Chat.findByIdAndUpdate(
    chatId,
    { chatName },
    { new: true }
  )
    .populate("users", "name pic email")
    .populate("groupAdmin", "name pic email");

  if (!updatedChat) {
    res.status(404);
    throw new Error("Chat Not Found");
  } else {
    res.json(updatedChat);
  }
});

// @desc    Remove user from Group
// @route   PUT /api/chat/groupremove
// @access  Protected
const removeFromGroup = asyncHandler(async (req, res) => {
  const { chatId, userId } = req.body;

  const removedChat = await Chat.findByIdAndUpdate(
    chatId,
    { $pull: { users: userId } },
    { new: true }
  )
    .populate("users", "name pic email")
    .populate("groupAdmin", "name pic email");

  if (!removedChat) {
    res.status(404);
    throw new Error("Chat Not Found");
  } else {
    res.json(removedChat);
  }
});

// @desc    Add user to Group / Leave
// @route   PUT /api/chat/groupadd
// @access  Protected
const addToGroup = asyncHandler(async (req, res) => {
  const { chatId, userId } = req.body;

  const addedChat = await Chat.findByIdAndUpdate(
    chatId,
    { $push: { users: userId } },
    { new: true }
  )
    .populate("users", "name pic email")
    .populate("groupAdmin", "name pic email");

  if (!addedChat) {
    res.status(404);
    throw new Error("Chat Not Found");
  } else {
    res.json(addedChat);
  }
});

module.exports = {
  accessChat,
  fetchChats,
  createGroupChat,
  renameGroup,
  removeFromGroup,
  addToGroup,
};
