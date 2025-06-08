local ExampleServiceServer = {}

function ExampleServiceServer.init(self: ExampleServiceServer)
	print("hi from ExampleServiceServer!")
end

export type ExampleServiceServer = typeof(ExampleServiceServer) & {}

return ExampleServiceServer
