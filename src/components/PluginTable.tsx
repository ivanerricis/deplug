import { useMemo } from "react"
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    OnChangeFn,
    RowSelectionState,
    useReactTable,
} from "@tanstack/react-table"

import { Plugin } from "../core/plugin/Plugin"
import RowDropdownMenu from "./RowDropdownMenu"
import { Checkbox } from "./ui/checkbox"

type PluginTableProps = {
    plugins: Plugin[]
    rowSelection: RowSelectionState
    onRowSelectionChange: OnChangeFn<RowSelectionState>
}

export default function PluginTable({
    plugins,
    rowSelection,
    onRowSelectionChange,
}: PluginTableProps) {
    const columns = useMemo<ColumnDef<Plugin>[]>(() => [
        {
            id: "select",
            size: 40,
            header: ({ table }) => {
                const checked =
                    table.getIsAllRowsSelected()
                        ? true
                        : table.getIsSomeRowsSelected()
                            ? "indeterminate"
                            : false

                return (
                    <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => table.toggleAllRowsSelected(!!value)}
                    />
                )
            },
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                />
            ),
            enableResizing: false,
        },

        {
            header: "Nome",
            accessorKey: "name",
            size: 250,
        },
        {
            header: "Tipo",
            accessorKey: "type",
            size: 120,
        },
        {
            header: "Percorso",
            accessorKey: "installPath",
            size: 600,
        },
        {
            id: "actions",
            size: 50,
            enableResizing: false,
            header: "",
            cell: ({ row }) => {
                const plugin = row.original

                return (
                    <RowDropdownMenu plugin={plugin}></RowDropdownMenu>
                )
            },
        },
    ], [])

    const table = useReactTable({
        data: plugins,
        columns,
        state: {
            rowSelection,
        },
        onRowSelectionChange,
        getCoreRowModel: getCoreRowModel(),
        enableRowSelection: true,
        columnResizeMode: "onChange",
    })

    return (
        <div className="w-full flex-1 min-h-0 overflow-auto border rounded">
            <div className="w-full max-w-full">
                {/* Header */}
                {table.getHeaderGroups().map(headerGroup => (
                    <div key={headerGroup.id} className="flex border-b bg-muted select-none">
                        {headerGroup.headers.map(header => (
                            <div
                                key={header.id}
                                className="relative px-2 py-1 font-bold border-r flex items-center"
                                style={{ width: header.getSize() }}
                            >
                                {flexRender(
                                    header.column.columnDef.header,
                                    header.getContext()
                                )}

                                {header.column.getCanResize() && (
                                    <div
                                        onMouseDown={header.getResizeHandler()}
                                        onTouchStart={header.getResizeHandler()}
                                        className={`absolute right-0 top-0 h-full w-1 cursor-col-resize ${header.column.getIsResizing() ? "bg-red-500" : "bg-transparent"
                                            }`}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                ))}

                {/* Body */}
                {table.getRowModel().rows.map(row => (
                    <div
                        key={row.id}
                        className={`flex border-b hover:bg-muted/50 ${row.getIsSelected() ? "bg-muted" : ""
                            }`}
                    >
                        {row.getVisibleCells().map(cell => (
                            <div
                                key={cell.id}
                                className="px-2 py-1 border-r truncate flex items-center"
                                style={{ width: cell.column.getSize() }}
                                title={String(cell.getValue())}
                            >
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    )
}
